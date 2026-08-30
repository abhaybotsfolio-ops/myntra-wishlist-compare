import { redirect } from "next/navigation";

// ARCHITECTURE.md §3 route map: "/" redirects to "/wishlist".
export default function RootPage() {
  redirect("/wishlist");
}
