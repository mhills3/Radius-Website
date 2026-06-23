import { initializeApp } from "firebase/app";
import { getFirestore, getDocs, collection, doc, updateDoc } from "firebase/firestore";
const cfg = { apiKey:"AIzaSyCVjfvMNwy5sLFjONGZFfPpPsnqO79IiPE", authDomain:"radius-dg.firebaseapp.com", projectId:"radius-dg", storageBucket:"radius-dg.firebasestorage.app", messagingSenderId:"357255426355", appId:"1:357255426355:web:3af86d8a659c10464bce46" };
const db = getFirestore(initializeApp(cfg));
const APPLY = process.argv.includes("--apply");
const snap = await getDocs(collection(db, "courses"));
const targets=[];
snap.forEach(d=>{ const x=d.data();
  const rev = String(x.reviewStatus||"").toLowerCase();
  const webDraft = x.isDraft===true && (rev==="draft"||rev==="pending"||rev==="rejected");
  if (webDraft && x.courseType!=="Private") targets.push({ref:d.ref, id:d.id, name:x.name, type:x.courseType, by:x.createdBy, rev:x.reviewStatus, planned:x.plannedCourseType});
});
console.log(`Web-created drafts to make Private (isDraft===true & reviewStatus draft, not already Private): ${targets.length}`);
for(const t of targets) console.log(`  ${(t.name||"?").slice(0,32).padEnd(32)} type=${t.type} by=${t.by}`);
if (APPLY) {
  let ok=0;
  for(const t of targets){ try{ await updateDoc(t.ref, { courseType:"Private", plannedCourseType: t.planned || t.type || "Public" }); ok++; }catch(e){ console.log("  FAIL", t.id, e.message);} }
  console.log(`\nAPPLIED: set ${ok}/${targets.length} drafts to Private (plannedCourseType preserved).`);
} else {
  console.log("\nDRY RUN — re-run with --apply to write.");
}
process.exit(0);
