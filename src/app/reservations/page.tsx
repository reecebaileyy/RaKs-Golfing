import { MyTeeTimes } from "@/components/MyTeeTimes";

export default function ReservationsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">My tee times</h1>
      <MyTeeTimes />
    </div>
  );
}
