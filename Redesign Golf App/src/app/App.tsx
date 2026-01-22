import { TournamentHeader } from '@/app/components/TournamentHeader';
import { Leaderboard } from '@/app/components/Leaderboard';
import { RuleOverrule } from '@/app/components/RuleOverrule';
import { GroupScorecard } from '@/app/components/GroupScorecard';
import { RecentActivity } from '@/app/components/RecentActivity';
import { HoleControl } from '@/app/components/HoleControl';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50">
      <TournamentHeader />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Leaderboard */}
          <div className="lg:col-span-2">
            <Leaderboard />
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            <HoleControl />
            <GroupScorecard />
            <RecentActivity />
            <RuleOverrule />
          </div>
        </div>
      </div>
    </div>
  );
}