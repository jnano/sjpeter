import { redirect } from "next/navigation";

export default function ParishRedirect() {
  redirect("/admin/parish/info");
}
