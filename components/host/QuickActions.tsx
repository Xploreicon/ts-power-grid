import Link from "next/link";
import { UserPlus, ArrowUpRight, LifeBuoy } from "lucide-react";

export function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      <Link
        href="/host/neighbors/new"
        className="flex flex-col items-center gap-2 bg-navy-950 text-white rounded-[12px] py-4 px-2 active:scale-[0.98] transition-all hover:bg-navy-800"
      >
        <UserPlus className="h-5 w-5 text-yellow-400" />
        <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-center">
          Add Neighbor
        </span>
      </Link>

      <Link
        href="/host/earnings/withdraw"
        className="flex flex-col items-center gap-2 bg-white border border-navy-100 rounded-[12px] py-4 px-2 active:scale-[0.98] transition-all hover:border-navy-200"
      >
        <ArrowUpRight className="h-5 w-5 text-navy-700" />
        <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-navy-700 text-center">
          Withdraw
        </span>
      </Link>

      <Link
        href="/host/support"
        className="flex flex-col items-center gap-2 bg-white border border-navy-100 rounded-[12px] py-4 px-2 active:scale-[0.98] transition-all hover:border-navy-200"
      >
        <LifeBuoy className="h-5 w-5 text-navy-700" />
        <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-navy-700 text-center">
          Support
        </span>
      </Link>
    </div>
  );
}
