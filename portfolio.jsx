import React from 'react';
import { Mail, Shield, Settings, Users, Lock, LogIn, BarChart3, Zap, Send } from 'lucide-react';

export default function Portfolio() {
  const servers = [
    { name: 'Chromerius', members: '200k' },
    { name: 'Tuff Guys', members: '50,000' },
    { name: 'Bagel SMP', members: '3,000' },
    { name: 'Crusty AFK Pvt.', members: '6,000' },
    { name: 'Rod And Reef', members: '5,000' },
    { name: 'Sword X Staff Guide', members: '7,000' },
    { name: 'Last Stand Arena', members: '100' },
  ];

  const services = [
    { icon: Settings, label: 'Role & Permission Setup' },
    { icon: LogIn, label: 'Channel Organization' },
    { icon: Users, label: 'Bot Setup & Config' },
    { icon: Send, label: 'Ticket Systems' },
    { icon: Shield, label: 'Anti-Raid Protection' },
    { icon: Lock, label: 'Server Security' },
    { icon: BarChart3, label: 'Automod & Logging' },
    { icon: Zap, label: 'Ongoing Improvements' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* Grid background effect */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(255,193,7,0.05) 25%, rgba(255,193,7,0.05) 26%, transparent 27%, transparent 74%, rgba(255,193,7,0.05) 75%, rgba(255,193,7,0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255,193,7,0.05) 25%, rgba(255,193,7,0.05) 26%, transparent 27%, transparent 74%, rgba(255,193,7,0.05) 75%, rgba(255,193,7,0.05) 76%, transparent 77%, transparent)',
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-20">
            <h1 className="text-7xl font-bold mb-2 tracking-tight">drizzyrev</h1>
            <p className="text-amber-400 text-xl font-medium mb-4">Community Manager</p>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">Dependable, experienced. Helping you with your discord server.</p>
          </div>

          {/* Stats Grid */}
          <div className="mb-20">
            <p className="text-slate-400 text-sm uppercase tracking-widest mb-8 text-center">Servers Managed</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servers.map((server, idx) => (
                <div key={idx} className="bg-slate-800/40 backdrop-blur border border-slate-700/50 rounded-lg p-6 hover:border-amber-400/30 transition-colors">
                  <h3 className="text-white font-semibold text-lg mb-2">{server.name}</h3>
                  <p className="text-amber-400 text-2xl font-bold">{server.members}</p>
                  <p className="text-slate-500 text-xs mt-1">members</p>
                </div>
              ))}
            </div>
          </div>

          {/* Services Section */}
          <div className="mb-20">
            <h2 className="text-3xl font-bold mb-12 text-center">What I Offer</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {services.map((service, idx) => {
                const Icon = service.icon;
                return (
                  <div key={idx} className="bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-lg p-6 hover:border-amber-400/20 transition-all hover:bg-slate-800/50">
                    <Icon className="w-8 h-8 text-amber-400 mb-4" />
                    <p className="text-sm font-medium text-white">{service.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment & Contact Section */}
          <div className="bg-gradient-to-r from-amber-600/20 to-amber-500/10 border border-amber-500/30 rounded-lg p-12 text-center">
            <h2 className="text-3xl font-bold mb-8">Pricing</h2>
            
            <div className="flex justify-center mb-10">
              <div>
                <p className="text-amber-400 font-semibold text-lg mb-2">Monthly</p>
                <p className="text-white text-5xl font-bold">$20</p>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded p-4 mb-8 max-w-md mx-auto">
              <p className="text-slate-300 text-sm mb-2">💎 Payment via Cash App</p>
            </div>


          </div>
        </div>

        {/* Footer accent */}
        <div className="mt-20 border-t border-slate-700/30">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <p className="text-slate-500 text-sm text-center">© Community Manager Portfolio</p>
          </div>
        </div>
      </div>
    </div>
  );
     }
