import { redirect } from "next/navigation";

export default async function OrderDetailPage({ params }) {
  const { id } = await params;
  redirect(`/orders?id=${id}`);
}
