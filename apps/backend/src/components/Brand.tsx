import Link from "next/link";
import s from "@/app/styles/portal.module.css";

export function Brand({ large = false, href }: { large?: boolean; href?: string }) {
  const content = (
    <>
      CSE <span>Attendance</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={s.brand}>
        {content}
      </Link>
    );
  }
  return <div className={large ? s.brandLarge : s.brand}>{content}</div>;
}
