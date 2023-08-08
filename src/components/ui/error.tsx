export default function Error({ msg }: { msg?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-12">
      <h3>{msg || "Error"}</h3>
    </div>
  );
}
