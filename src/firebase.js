import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { collection, doc, getFirestore, onSnapshot, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDrhSS0WqXjQwStu8iK-0cSVkQ78UUU4Xg",
  authDomain: "istoki-family-tree-vit.firebaseapp.com",
  projectId: "istoki-family-tree-vit",
  storageBucket: "istoki-family-tree-vit.firebasestorage.app",
  messagingSenderId: "972568992732",
  appId: "1:972568992732:web:a4b0de3aff1dc9fb5dcd19",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const OWNER_EMAIL = "merzopakostniy@gmail.com";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
const peopleCollection = collection(db, "trees", "main", "people");
const PERSON_FIELDS = [
  "id", "name", "birth", "death", "relation", "generation", "parents", "partnerIds", "currentPartnerId", "formerPartnerIds",
  "birthplace", "deathplace", "maidenName", "manualGeneration", "note", "photo",
  "photoX", "photoY", "photoScale", "manualX", "manualY", "manualPositionVersion",
];

export function isOwnerUser(user) {
  return Boolean(user?.emailVerified && user.email === OWNER_EMAIL);
}

export function signInOwner() {
  return signInWithPopup(auth, provider);
}

export function signOutOwner() {
  return signOut(auth);
}

export function subscribeToPeople(onPeople, onError) {
  return onSnapshot(peopleCollection, (snapshot) => {
    onPeople(snapshot.docs.map((snapshotDoc) => ({ ...snapshotDoc.data(), id: snapshotDoc.id })));
  }, onError);
}

function cloudPerson(person) {
  const result = {};
  PERSON_FIELDS.forEach((field) => { result[field] = person[field]; });
  if (typeof result.photo === "string" && new Blob([result.photo]).size > 900000) {
    throw new Error(`Фотография «${result.name}» слишком большая для облака. Загрузите её заново.`);
  }
  return result;
}

export async function syncPeople(previousPeople, nextPeople) {
  const previous = new Map(previousPeople.map((person) => [person.id, person]));
  const next = new Map(nextPeople.map((person) => [person.id, person]));
  const operations = [];
  next.forEach((person, id) => {
    if (JSON.stringify(previous.get(id)) !== JSON.stringify(person)) operations.push({ type: "set", id, person: cloudPerson(person) });
  });
  previous.forEach((_person, id) => {
    if (!next.has(id)) operations.push({ type: "delete", id });
  });

  for (let offset = 0; offset < operations.length; offset += 450) {
    const batch = writeBatch(db);
    operations.slice(offset, offset + 450).forEach((operation) => {
      const reference = doc(db, "trees", "main", "people", operation.id);
      if (operation.type === "set") batch.set(reference, operation.person);
      else batch.delete(reference);
    });
    await batch.commit();
  }
}
