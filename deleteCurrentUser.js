import { getDatabase, ref, remove } from "firebase/database";
import { deleteUser } from "firebase/auth";
import { auth } from "../firebase";

const db = getDatabase();

export async function deleteCurrentUser() {
  try {
    const user = auth.currentUser;
    if (!user) {
      alert("No user logged in");
      return;
    }

    const uid = user.uid;

    // Delete auth user
    await deleteUser(user);

    // Delete DB record
    await remove(ref(db, `users/${uid}`));

    alert("User and database record deleted");
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}