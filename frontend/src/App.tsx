import React, { useState, useEffect } from 'react';
import { 
  Calendar, CheckSquare, DollarSign, MessageSquare, Shield, User as UserIcon, 
  Video, MapPin, Search, Star, Clock, AlertTriangle, Send, Mail, X, PlusCircle, ExternalLink, RefreshCw
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:5050/api' : '/api';

export default function App() {
  // Navigation & User Context
  const [currentUser, setCurrentUser] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authRole, setAuthRole] = useState('organizer');
  
  // Provider specifics
  const [providerType, setProviderType] = useState('caterer');
  const [providerPrice, setProviderPrice] = useState(500);
  const [providerDesc, setProviderDesc] = useState('');

  // Active Menu Tabs
  const [activeTab, setActiveTab] = useState('events');

  // Operational State lists
  const [events, setEvents] = useState([]);
  const [providers, setProviders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Create Event states
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventBudget, setNewEventBudget] = useState(1000);
  const [newEventType, setNewEventType] = useState('physical');
  const [newEventLink, setNewEventLink] = useState('');

  // Analytics states
  const [analytics, setAnalytics] = useState(null);

  // Status Alerts
  const [statusMsg, setStatusMsg] = useState('');

  // Paystack Public Key
  const [paystackPublicKey, setPaystackPublicKey] = useState(
    localStorage.getItem('PAYSTACK_PUBLIC_KEY') || 'pk_test_051197ca6657d8c8c67200dee4373af4490fcd2d'
  );

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    try {
      if (currentUser.role === 'organizer') {
        const eventsRes = await fetch(`${API_BASE}/events?organizerId=${currentUser._id}`);
        setEvents(await eventsRes.json());

        const providersRes = await fetch(`${API_BASE}/providers`);
        setProviders(await providersRes.json());

        const bookingsRes = await fetch(`${API_BASE}/bookings?organizerId=${currentUser._id}`);
        setBookings(await bookingsRes.json());

        const analRes = await fetch(`${API_BASE}/analytics/organizer/${currentUser._id}`);
        setAnalytics(await analRes.json());
      } else {
        const bookingsRes = await fetch(`${API_BASE}/bookings?providerId=${currentUser._id}`);
        setBookings(await bookingsRes.json());

        const analRes = await fetch(`${API_BASE}/analytics/provider/${currentUser._id}`);
        setAnalytics(await analRes.json());
      }
    } catch (e) {
      console.error("Failed loading data", e);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          name: authName,
          role: authRole,
          serviceName: authRole === 'provider' ? `${authName} Services` : undefined,
          serviceType: authRole === 'provider' ? providerType : undefined,
          price: authRole === 'provider' ? providerPrice : undefined,
          description: authRole === 'provider' ? providerDesc : undefined
        })
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        setStatusMsg("Successfully registered!");
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (error) {
      alert("Registration failed");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        setStatusMsg("Logged in!");
      } else {
        alert("Invalid email or password");
      }
    } catch (error) {
      alert("Login failed");
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEventName,
          date: newEventDate,
          location: newEventLocation,
          budget: newEventBudget,
          eventType: newEventType,
          meetingLink: newEventType === 'virtual' ? newEventLink : '',
          organizerId: currentUser._id
        })
      });
      if (res.ok) {
        fetchData();
        setNewEventName('');
        setNewEventDate('');
        setNewEventLocation('');
        setNewEventBudget(1000);
        setNewEventLink('');
        setStatusMsg("Event created successfully!");
      }
    } catch (err) {
      alert("Error creating event");
    }
  };

  const handleAddTask = async (eventId, currentTasks, text) => {
    try {
      const updatedTasks = [...currentTasks, { text, completed: false }];
      await fetch(`${API_BASE}/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTask = async (eventId, currentTasks, index) => {
    try {
      const updatedTasks = [...currentTasks];
      updatedTasks[index].completed = !updatedTasks[index].completed;
      await fetch(`${API_BASE}/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBookProvider = async (provider) => {
    if (events.length === 0) {
      alert("Please create an event first before booking services!");
      return;
    }
    const targetEvent = events[0]; // pick first event for demo simplicity
    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: targetEvent._id,
          provider: provider._id,
          organizer: currentUser._id,
          price: provider.price || 100
        })
      });
      if (res.ok) {
        fetchData();
        setStatusMsg(`Booking request submitted to ${provider.name}!`);
        setActiveTab('bookings');
      }
    } catch (err) {
      alert("Booking failed");
    }
  };

  // Paystack Live Inline checkout
  const payWithPaystack = (booking) => {
    if (!window.PaystackPop) {
      alert("Paystack SDK not loaded. Check internet connection.");
      return;
    }

    const handler = window.PaystackPop.setup({
      key: paystackPublicKey,
      email: currentUser.email,
      amount: booking.price * 100, // Paystack requires amount in lowest currency subunit
      currency: "GHS", // e.g. Ghanaian Cedis, Nigerian Naira (NGN), South African Rand (ZAR)
      ref: 'EVT-' + Math.floor((Math.random() * 1000000000) + 1),
      callback: async function(response) {
        setStatusMsg("Payment success! Verifying...");
        // Verify payment against server
        const verifyRes = await fetch(`${API_BASE}/payments/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: response.reference,
            bookingId: booking._id
          })
        });
        if (verifyRes.ok) {
          setStatusMsg("Transaction verified. Booking confirmed & emails sent!");
          fetchData();
        } else {
          alert("Payment verification failed. Please contact support.");
        }
      },
      onClose: function() {
        alert("Transaction was not completed.");
      }
    });
    handler.openIframe();
  };

  // Live Cancel & Paystack Refund
  const handleCancelBooking = async (bookingId) => {
    const reason = prompt("Enter reason for cancellation:");
    if (!reason) return;

    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        setStatusMsg("Booking cancelled. Check dashboard status for refund updates!");
        fetchData();
      }
    } catch (err) {
      alert("Failed to cancel booking");
    }
  };

  // Messaging / Communication System
  const openChat = async (booking) => {
    setSelectedBooking(booking);
    try {
      const res = await fetch(`${API_BASE}/messages?bookingId=${booking._id}`);
      setMessages(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedBooking) return;
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: currentUser._id,
          receiver: currentUser.role === 'organizer' ? selectedBooking.provider._id : selectedBooking.organizer._id,
          booking: selectedBooking._id,
          content: newMessage
        })
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages([...messages, msg]);
        setNewMessage('');
      }
    } catch (e) {
      alert("Error sending message");
    }
  };

  const refreshChat = async () => {
    if (selectedBooking) {
      openChat(selectedBooking);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="glassmorphism max-w-md w-full p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Event Planner Platform
            </h1>
            <p className="text-sm text-slate-400">Complete, live end-to-end compliant scheduler</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Email Address</label>
              <input 
                type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Password</label>
              <input 
                type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" 
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-2 rounded-lg font-medium text-sm transition-all">
                Login
              </button>
            </div>
          </form>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
            <span className="relative bg-slate-950 px-2 text-xs text-slate-400">OR CREATE NEW USER</span>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Full Name</label>
              <input 
                type="text" required value={authName} onChange={e => setAuthName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Select Persona</label>
              <select 
                value={authRole} onChange={e => setAuthRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="organizer">Event Organizer / User</option>
                <option value="provider">Service Provider / Vendor</option>
              </select>
            </div>

            {authRole === 'provider' && (
              <div className="space-y-3 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Service Category</label>
                  <select 
                    value={providerType} onChange={e => setProviderType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm focus:outline-none"
                  >
                    <option value="caterer">Caterer</option>
                    <option value="decorator">Decorator</option>
                    <option value="entertainer">Entertainer</option>
                    <option value="photographer">Photographer</option>
                    <option value="venue">Venue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Service Price (GHS / NGN)</label>
                  <input 
                    type="number" value={providerPrice} onChange={e => setProviderPrice(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Description / Showcase</label>
                  <textarea 
                    value={providerDesc} onChange={e => setProviderDesc(e.target.value)} placeholder="Showcase details"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm focus:outline-none" 
                  />
                </div>
              </div>
            )}

            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-lg font-medium text-sm transition-all">
              Register Account
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 glassmorphism border-r border-slate-800 p-6 flex flex-col justify-between">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Event Planner
            </h2>
            <div className="mt-2 text-xs flex items-center gap-1.5 text-slate-400 bg-slate-900/50 p-2 rounded-md border border-slate-800">
              <UserIcon size={12} className="text-indigo-400" />
              <span>{currentUser.name} ({currentUser.role})</span>
            </div>
          </div>

          <nav className="space-y-2">
            {currentUser.role === 'organizer' && (
              <>
                <button onClick={() => setActiveTab('events')} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-2 ${activeTab === 'events' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:bg-slate-900'}`}>
                  <Calendar size={16} /> My Events
                </button>
                <button onClick={() => setActiveTab('providers')} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-2 ${activeTab === 'providers' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:bg-slate-900'}`}>
                  <Search size={16} /> Find Providers
                </button>
              </>
            )}
            <button onClick={() => setActiveTab('bookings')} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-2 ${activeTab === 'bookings' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:bg-slate-900'}`}>
              <CheckSquare size={16} /> Bookings
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:bg-slate-900'}`}>
              <DollarSign size={16} /> Dashboard Analytics
            </button>
          </nav>
        </div>

        <div className="space-y-4 pt-6 border-t border-slate-800">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Paystack Public Key</label>
            <input 
              type="text" value={paystackPublicKey} onChange={e => {
                setPaystackPublicKey(e.target.value);
                localStorage.setItem('PAYSTACK_PUBLIC_KEY', e.target.value);
              }}
              className="w-full bg-slate-900 text-xs border border-slate-800 rounded px-2 py-1 focus:outline-none" 
            />
          </div>
          <button onClick={() => setCurrentUser(null)} className="w-full text-center py-2 px-3 rounded-lg text-sm font-semibold border border-rose-500/20 hover:bg-rose-500/10 text-rose-400 transition-all">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 space-y-6 overflow-y-auto">
        {statusMsg && (
          <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl flex items-center justify-between text-sm">
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg('')} className="text-emerald-400 hover:text-emerald-200">
              <X size={16} />
            </button>
          </div>
        )}

        {/* 1. EVENTS TAB */}
        {activeTab === 'events' && currentUser.role === 'organizer' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-2xl font-bold">Your Events</h3>
              
              {events.length === 0 ? (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No events created yet. Use the creation form to begin planning.
                </div>
              ) : (
                events.map(evt => (
                  <div key={evt._id} className="glassmorphism p-6 rounded-xl space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xl font-semibold text-indigo-300">{evt.name}</h4>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                          <Calendar size={12} /> {new Date(evt.date).toDateString()}
                          {evt.location && <><MapPin size={12} className="ml-2" /> {evt.location}</>}
                        </p>
                        {evt.eventType === 'virtual' && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Video size={12} /> Virtual Event
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 uppercase font-semibold">Budget Limit</span>
                        <div className="text-lg font-bold text-indigo-400">GHS {evt.budget}</div>
                      </div>
                    </div>

                    {evt.eventType === 'virtual' && evt.meetingLink && (
                      <div className="p-3 bg-slate-900 rounded-lg flex items-center justify-between border border-slate-800 text-sm">
                        <span className="text-slate-400">Meeting Link:</span>
                        <a href={evt.meetingLink} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                          Join Live <ExternalLink size={14} />
                        </a>
                      </div>
                    )}

                    {/* Task Checklist */}
                    <div className="space-y-2 border-t border-slate-850 pt-4">
                      <div className="text-sm font-semibold flex items-center justify-between">
                        <span>Tasks Timeline Checklist</span>
                        <span className="text-xs text-slate-400">
                          {evt.tasks.filter(t => t.completed).length}/{evt.tasks.length} Completed
                        </span>
                      </div>
                      <div className="space-y-1">
                        {evt.tasks.map((task, idx) => (
                          <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer py-1 px-2 hover:bg-slate-900 rounded">
                            <input 
                              type="checkbox" checked={task.completed} onChange={() => handleToggleTask(evt._id, evt.tasks, idx)}
                              className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0" 
                            />
                            <span className={task.completed ? 'line-through text-slate-500' : 'text-slate-350'}>{task.text}</span>
                          </label>
                        ))}
                      </div>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const txt = formData.get('taskText');
                        if (txt) {
                          handleAddTask(evt._id, evt.tasks, txt.toString());
                          e.currentTarget.reset();
                        }
                      }} className="flex gap-2 mt-2">
                        <input name="taskText" placeholder="Add custom action task..." className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs" />
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded text-xs">Add</button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Create Event Panel */}
            <div className="glassmorphism p-6 rounded-xl space-y-4 h-fit">
              <h4 className="text-lg font-bold">New Planning Event</h4>
              <form onSubmit={handleCreateEvent} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Event Name</label>
                  <input type="text" required value={newEventName} onChange={e => setNewEventName(e.target.value)} placeholder="e.g. Corporate Summit / Wedding" className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Event Date</label>
                  <input type="date" required value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Location Address</label>
                  <input type="text" value={newEventLocation} onChange={e => setNewEventLocation(e.target.value)} placeholder="City / Country / Virtual Venue" className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Total Budget Goal (GHS)</label>
                  <input type="number" value={newEventBudget} onChange={e => setNewEventBudget(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Event Format</label>
                  <select value={newEventType} onChange={e => setNewEventType(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200">
                    <option value="physical">Physical Location</option>
                    <option value="virtual">Virtual Format (Zoom / GMeet)</option>
                  </select>
                </div>
                {newEventType === 'virtual' && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Google Meet / Zoom URL</label>
                    <input type="url" value={newEventLink} onChange={e => setNewEventLink(e.target.value)} placeholder="https://meet.google.com/..." className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200" />
                  </div>
                )}
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 py-2 rounded-lg font-medium">Create Project</button>
              </form>
            </div>
          </div>
        )}

        {/* 2. FIND PROVIDERS TAB */}
        {activeTab === 'providers' && currentUser.role === 'organizer' && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">Browse Certified Providers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {providers.map(p => (
                <div key={p._id} className="glassmorphism p-6 rounded-xl flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">{p.serviceType || 'Specialist'}</span>
                    <h4 className="text-lg font-semibold mt-2">{p.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-3">{p.description || 'Professional event solution provider available for events.'}</p>
                    <div className="flex items-center gap-1 text-amber-400 mt-2 text-sm">
                      <Star size={14} fill="currentColor" /> {p.rating.toFixed(1)} <span className="text-xs text-slate-500">({p.reviewsCount} reviews)</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-slate-850">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Starting Rate</span>
                      <span className="text-lg font-bold text-emerald-400">GHS {p.price || 100}</span>
                    </div>
                    <button onClick={() => handleBookProvider(p)} className="bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg text-xs font-semibold">
                      Book Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. BOOKINGS TAB */}
        {activeTab === 'bookings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-2xl font-bold">Bookings Management</h3>
              
              {bookings.length === 0 ? (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No active booking records found.
                </div>
              ) : (
                bookings.map(b => (
                  <div key={b._id} className="glassmorphism p-5 rounded-xl space-y-4 relative">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-semibold text-slate-200">
                          {currentUser.role === 'organizer' ? b.provider?.name : b.organizer?.name}
                        </h4>
                        <p className="text-xs text-slate-450 mt-0.5">Booking Ref ID: {b._id}</p>
                        <p className="text-xs text-slate-400 mt-1">Event: <strong>{b.event?.name}</strong> ({new Date(b.event?.date).toDateString()})</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border" 
                          style={{
                            borderColor: b.status === 'paid' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                            color: b.status === 'paid' ? '#10b981' : '#f59e0b',
                            backgroundColor: b.status === 'paid' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'
                          }}
                        >
                          {b.status}
                        </span>
                        <div className="text-lg font-bold text-indigo-400 mt-2">GHS {b.price}</div>
                      </div>
                    </div>

                    {b.refundStatus && b.refundStatus !== 'none' && (
                      <div className="p-2.5 bg-slate-900 rounded-lg text-xs flex justify-between border border-rose-500/20 text-rose-300">
                        <span>Refund Processed:</span>
                        <strong className="uppercase">{b.refundStatus} (GHS {b.refundAmount})</strong>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-slate-850">
                      <button onClick={() => openChat(b)} className="flex-1 bg-slate-900 hover:bg-slate-800 text-xs py-2 rounded border border-slate-800 flex items-center justify-center gap-1.5 font-semibold">
                        <MessageSquare size={14} /> Communication Chat
                      </button>
                      
                      {currentUser.role === 'organizer' && b.status === 'pending' && (
                        <button onClick={() => payWithPaystack(b)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-xs py-2 rounded text-white font-semibold flex items-center justify-center gap-1">
                          <Shield size={14} /> Pay with Paystack
                        </button>
                      )}

                      {b.status !== 'cancelled' && (
                        <button onClick={() => handleCancelBooking(b._id)} className="px-3 bg-red-950/35 hover:bg-red-950 text-xs py-2 rounded text-red-400 border border-red-900/30 font-semibold">
                          Cancel Bookings
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* In-app Chat / Communication Sidebar Panel */}
            <div className="glassmorphism p-5 rounded-xl flex flex-col h-[500px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                  <MessageSquare size={16} /> Chat Workspace
                </h4>
                {selectedBooking && (
                  <button onClick={refreshChat} className="text-slate-400 hover:text-slate-200">
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>

              {!selectedBooking ? (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500 text-center">
                  Select a booking communication chat to message provider or user.
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
                    {messages.map((m, idx) => (
                      <div key={idx} className={`max-w-[85%] p-2 rounded-lg text-xs ${m.sender === currentUser._id ? 'bg-indigo-600 text-white ml-auto' : 'bg-slate-900 border border-slate-850 mr-auto text-slate-200'}`}>
                        <div>{m.content}</div>
                        <div className="text-[9px] text-slate-300 mt-1 text-right">{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-slate-800 pt-3">
                    <input 
                      type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type chat message..." 
                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs focus:outline-none" 
                    />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 p-2 rounded"><Send size={12} /></button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* 4. DASHBOARD ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">Compliance Analytics Platform</h3>
            
            {analytics ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {currentUser.role === 'organizer' ? (
                  <>
                    <div className="glassmorphism p-6 rounded-xl text-center space-y-2">
                      <span className="text-xs text-slate-400 uppercase font-semibold">Total Budget Planned</span>
                      <div className="text-3xl font-extrabold text-indigo-400">GHS {analytics.totalBudget}</div>
                    </div>
                    <div className="glassmorphism p-6 rounded-xl text-center space-y-2">
                      <span className="text-xs text-slate-400 uppercase font-semibold">Total Spent (Paid)</span>
                      <div className="text-3xl font-extrabold text-emerald-400">GHS {analytics.totalSpent}</div>
                    </div>
                    <div className="glassmorphism p-6 rounded-xl text-center space-y-2">
                      <span className="text-xs text-slate-400 uppercase font-semibold">Tracked Event Projects</span>
                      <div className="text-3xl font-extrabold text-indigo-400">{analytics.eventsCount}</div>
                    </div>

                    <div className="md:col-span-3 glassmorphism p-6 rounded-xl space-y-4">
                      <h4 className="text-sm font-semibold">Budget Category Spend Distribution</h4>
                      {Object.keys(analytics.spendingByCategory).length === 0 ? (
                        <div className="text-xs text-slate-500">No payment data recorded yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(analytics.spendingByCategory).map(([cat, val]) => (
                            <div key={cat} className="space-y-1">
                              <div className="flex justify-between text-xs text-slate-350">
                                <span className="capitalize">{cat}</span>
                                <span>GHS {val}</span>
                              </div>
                              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, (val / (analytics.totalBudget || 1)) * 100)}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="glassmorphism p-6 rounded-xl text-center space-y-2">
                      <span className="text-xs text-slate-400 uppercase font-semibold">Total Revenue (Paid)</span>
                      <div className="text-3xl font-extrabold text-emerald-400">GHS {analytics.totalRevenue}</div>
                    </div>
                    <div className="glassmorphism p-6 rounded-xl text-center space-y-2">
                      <span className="text-xs text-slate-400 uppercase font-semibold">Average Rating score</span>
                      <div className="text-3xl font-extrabold text-amber-400">{analytics.avgRating.toFixed(1)} / 5.0</div>
                    </div>
                    <div className="glassmorphism p-6 rounded-xl text-center space-y-2">
                      <span className="text-xs text-slate-400 uppercase font-semibold">Total Booking Requests</span>
                      <div className="text-3xl font-extrabold text-indigo-400">{analytics.totalBookings}</div>
                    </div>
                  </>
                )}
                
              </div>
            ) : (
              <div className="text-slate-500">Analytics dashboard offline or loading database records...</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
