import { AlertCircle, MessageSquare, UserCheck } from 'lucide-react';

export function RuleOverrule() {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-orange-50 to-orange-100 px-4 py-3 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-600" />
          <h3 className="font-bold text-orange-900">Rule overrule</h3>
        </div>
        <p className="text-xs text-orange-700 mt-1">Can be used with care and admin #</p>
      </div>
      
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-blue-900 mb-1">Annotative</h4>
            <button className="text-xs text-blue-700 hover:text-blue-900 font-medium">
              Live scores and any teams
            </button>
          </div>
        </div>
        
        <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <UserCheck className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-purple-900 mb-1">MPG</h4>
            <button className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors">
              Export & Remort
            </button>
            <p className="text-xs text-purple-700 mt-2">
              Can export course and player data with this tool
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
