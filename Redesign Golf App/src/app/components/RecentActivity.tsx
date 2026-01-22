import { Clock, Users, MapPin, Radio } from 'lucide-react';

interface Activity {
  time: string;
  type: 'playing' | 'playing-1' | 'playing-2' | 'playing-3' | 'playing-4';
  description: string;
}

const activities: Activity[] = [
  {
    time: '10:25 p.m.',
    type: 'playing',
    description: 'Jon Mitchell, Jon Michaels, Sam Sexton at Southbreeze'
  },
  {
    time: '10:13 p.m.',
    type: 'playing-1',
    description: 'Lynel Jackson, Jett von Bergeren, J. James, Ryan Hill'
  },
  {
    time: '10:01 p.m.',
    type: 'playing-2',
    description: 'Shane Lacey, Jr. Mason, Jacob Bridgestone, Tosumet Dasgupta'
  },
  {
    time: '9:49 p.m.',
    type: 'playing-3',
    description: 'Tiaan Swanepoel, Martin Serocki, Firoze Lautenschlager, Jithem Muller'
  },
  {
    time: '9:37 p.m.',
    type: 'playing-4',
    description: 'Ruben Modding, Mark Pipkins, Camren Gavisk, Hon Stair'
  },
  {
    time: '9:25 p.m.',
    type: 'playing',
    description: 'Fransezca Garza, Alicia Castillo, Ellison Fowler, Hans English'
  },
  {
    time: '9:13 p.m.',
    type: 'playing-1',
    description: 'Ty McVay, Alfonso Santos, Elmer Clafin, Darex English'
  }
];

export function RecentActivity() {
  const getBadgeStyle = (type: string) => {
    switch(type) {
      case 'playing':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'playing-1':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'playing-2':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'playing-3':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'playing-4':
        return 'bg-pink-100 text-pink-700 border-pink-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-50 to-green-100 px-4 py-3 border-b border-green-200">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-green-600" />
          <h3 className="font-bold text-green-900">On Course Tracker</h3>
        </div>
        <p className="text-xs text-green-700 mt-1">Live group positions</p>
      </div>
      
      {/* Featured Group Section */}
      <div className="p-4 bg-gradient-to-r from-green-600 to-green-700 border-b border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-green-100" />
          <span className="text-xs font-semibold text-green-100 uppercase tracking-wide">Featured Group</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-white">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-green-200" />
            <span className="font-medium">Tee 10:33 a.m.</span>
          </div>
          <span className="text-green-300">•</span>
          <span className="font-medium">Next 11:53 a.m.</span>
          <span className="text-green-300">•</span>
          <div className="px-2.5 py-1 bg-white/20 rounded-full font-bold text-white border border-white/30">
            Playing 15
          </div>
        </div>
      </div>
      
      <div className="divide-y divide-gray-100">
        {activities.map((activity, index) => (
          <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 pt-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-500">{activity.time}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getBadgeStyle(activity.type)}`}>
                    {activity.type.replace('-', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{activity.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          A Manual overrule activated
        </p>
      </div>
    </div>
  );
}