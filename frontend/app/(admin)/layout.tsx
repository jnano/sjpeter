export default function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div data-skin="admin">{children}</div>;
}
