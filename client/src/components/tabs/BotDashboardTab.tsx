import { useState } from "react";
import CustomDropdown from "@/components/CustomDropdown";
import InsightsDateRangePicker from "@/components/InsightsDateRangePicker";
import BotDashboardContent from "./bot-dashboard/BotDashboardContent";

// Bot selector options — should be fetched from workspace's actual bots once
// `GET /api/workspace/bots` is wired. Empty by default for fresh workspaces.
const botOptions: Array<{ id: string; name: string }> = [];

export default function BotDashboardTab() {
  const [selectedBots, setSelectedBots] = useState<string[]>([]);

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <div className="flex items-center justify-end p-1.5 rounded-xl bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
        <InsightsDateRangePicker tab="bot" />
      </div>
      {/* Dashboard Content */}
      <BotDashboardContent />
    </div>
  );
}

