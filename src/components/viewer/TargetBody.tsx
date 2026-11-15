import Body3D from "../Body3D.tsx";
import { KIND_LABEL, kindOf, type Neighbour } from "../../lib/stellar.ts";
import styles from "./TargetBody.module.css";

export default function TargetBody({ star }: { star: Neighbour }) {
  const kind = kindOf(star);
  return (
    <div className={styles.wrap} title="An artist’s impression chosen from the spectral type. It is not an image of the object.">
      <Body3D kind={kind} id={star.id} className={styles.stage} caption={false} />
      <span className={styles.label}>
        {KIND_LABEL[kind]} · {star.sp}
        <br />
        <span className={styles.note}>impression, not an image</span>
      </span>
    </div>
  );
}
