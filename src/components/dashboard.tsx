"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Baby,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Download,
  FileCheck2,
  FileText,
  Fingerprint,
  Home,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { serviceCatalog, type ServiceInfo } from "@/lib/catalog";

type User = {
  id: string;
  name: string;
  email: string;
  role: "citizen" | "agent" | "admin";
  verificationStatus?: "pending" | "verified" | "rejected";
};

type ServiceRequest = {
  _id: string;
  reference: string;
  serviceName: string;
  applicantName: string;
  status: string;
  quotedTotal: number;
  assistanceFee?: number;
  createdAt: string;
  timeline?: { status: string; note: string; createdAt?: string }[];
  documents?: { _id: string; originalName: string; documentType?: string; mimeType: string; size: number }[];
  canAccept?: boolean;
  assignedAgent?: { name: string };
};

type Panel = "overview" | "requests" | "services" | "admin";
type AuthMode = "login" | "register";

const serviceIcons = {
  baby: Baby,
  wallet: Wallet,
  badge: BadgeCheck,
  home: Home,
  "credit-card": CreditCard,
  fingerprint: Fingerprint,
};

const demoRequests: ServiceRequest[] = [
  {
    _id: "demo-1",
    reference: "JS-2026-00482",
    serviceName: "Income certificate",
    applicantName: "Aarav Mehta",
    status: "in_progress",
    quotedTotal: 279,
    createdAt: "2026-10-14T08:30:00.000Z",
    assignedAgent: { name: "Priya Sharma" },
  },
  {
    _id: "demo-2",
    reference: "JS-2026-00421",
    serviceName: "PAN card services",
    applicantName: "Aarav Mehta",
    status: "completed",
    quotedTotal: 306,
    createdAt: "2026-10-07T08:30:00.000Z",
    assignedAgent: { name: "Ankit Rao" },
  },
  {
    _id: "demo-3",
    reference: "JS-2026-00396",
    serviceName: "Domicile certificate",
    applicantName: "Aarav Mehta",
    status: "under_review",
    quotedTotal: 329,
    createdAt: "2026-09-30T08:30:00.000Z",
  },
];

const statusNames: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  accepted: "Agent assigned",
  in_progress: "In progress",
  documents_required: "Documents needed",
  completed: "Completed",
  rejected: "Not approved",
  cancelled: "Cancelled",
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

function statusClass(status: string) {
  if (status === "completed") return "status status-complete";
  if (status === "in_progress" || status === "accepted") return "status status-active";
  if (status === "documents_required" || status === "rejected") return "status status-attention";
  return "status status-pending";
}

export default function Dashboard() {
  const [panel, setPanel] = useState<Panel>("overview");
  const [user, setUser] = useState<User | null>(null);
  const [services, setServices] = useState(serviceCatalog);
  const [requests, setRequests] = useState<ServiceRequest[]>(demoRequests);
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);
  const [detailRequest, setDetailRequest] = useState<ServiceRequest | null>(null);
  const [submissionConfirmation, setSubmissionConfirmation] = useState<{
    reference: string;
    serviceName: string;
    status: string;
  } | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authRole, setAuthRole] = useState<"citizen" | "agent">("citizen");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [acceptingId, setAcceptingId] = useState("");
  const [error, setError] = useState("");

  async function loadRequests() {
    const response = await fetch("/api/requests", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { requests: ServiceRequest[] };
    setRequests(data.requests);
  }

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = (await response.json()) as { user: User | null };
        if (!active) return;
        setUser(data.user);
        if (data.user) setRequests([]);
        if (data.user && (data.user.role !== "agent" || data.user.verificationStatus === "verified")) await loadRequests();
      } catch {
        if (active) setToast("We could not check your sign-in status.");
      }
    }
    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/services", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { services: ServiceInfo[] };
        if (active && data.services.length > 0) setServices(data.services);
      })
      .catch(() => {
        if (active) setToast("The live service catalog could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleServices = useMemo(
    () => services.filter((service) =>
      `${service.name} ${service.category} ${service.description} ${service.requiredDocuments.join(" ")}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ),
    [search, services],
  );
  const activeRequests = requests.filter((request) => !["completed", "rejected", "cancelled"].includes(request.status));
  const completedRequests = requests.filter((request) => request.status === "completed").length;
  const userInitials = user?.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function beginRequest(service: ServiceInfo) {
    setSelectedService(service);
    if (user && user.role !== "citizen") {
      setToast("Service requests can be submitted from a citizen account.");
      return;
    }
    setRequestOpen(true);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string | string[]> = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    if (authMode === "register") {
      payload.name = String(form.get("name") ?? "");
      payload.phone = String(form.get("phone") ?? "");
      if (authRole === "agent") {
        payload.serviceAreas = String(form.get("serviceAreas") ?? "")
          .split(",")
          .map((area) => area.trim())
          .filter(Boolean);
      }
    }
    const endpoint =
      authMode === "login"
        ? "/api/auth/login"
        : authRole === "agent"
          ? "/api/auth/agent-registration"
          : "/api/auth/register";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { user?: User; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error ?? "Could not sign in.");
      setUser(data.user);
      setRequests([]);
      setAuthOpen(false);
      if (data.user.role === "agent" && data.user.verificationStatus !== "verified") {
        setToast("Your agent application is in review. We’ll email you when it’s verified.");
      } else if (selectedService && data.user.role === "citizen") {
        setRequestOpen(true);
      } else {
        setToast(`Welcome${data.user.name ? `, ${data.user.name.split(" ")[0]}` : ""}!`);
      }
      if (data.user.role !== "agent" || data.user.verificationStatus === "verified") {
        try {
          await loadRequests();
        } catch {
          setToast("Signed in. Your request history could not be loaded.");
        }
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Could not sign in.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService) return;
    setRequestBusy(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    formData.set("serviceSlug", selectedService.slug);
    try {
      const response = await fetch("/api/requests", { method: "POST", body: formData });
      const data = (await response.json()) as {
        request?: { reference: string; serviceName: string; status: string };
        error?: string;
      };
      if (!response.ok || !data.request) throw new Error(data.error ?? "Request could not be submitted.");
      setRequestOpen(false);
      setPanel("requests");
      setRequests(user ? requests : []);
      setSubmissionConfirmation(data.request);
      if (user) await loadRequests();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request could not be submitted.");
    } finally {
      setRequestBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setRequests(demoRequests);
    setToast("You have signed out.");
  }

  async function acceptRequest(serviceRequest: ServiceRequest) {
    setAcceptingId(serviceRequest._id);
    try {
      const response = await fetch(`/api/requests/${serviceRequest._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Request could not be accepted.");
      setToast(`${serviceRequest.reference} is now assigned to you.`);
      await loadRequests();
    } catch (acceptError) {
      setToast(acceptError instanceof Error ? acceptError.message : "Request could not be accepted.");
    } finally {
      setAcceptingId("");
    }
  }

  function openAuth(mode: AuthMode = "login") {
    setAuthMode(mode);
    setAuthRole("citizen");
    setAuthOpen(true);
    setError("");
  }

  function navigate(nextPanel: Panel) {
    setPanel(nextPanel);
    setMobileMenuOpen(false);
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={22} strokeWidth={2.1} /></div>
          <div><span className="brand-name">janseva<span>.</span></span><span className="brand-caption">YOUR LOCAL SERVICE DESK</span></div>
          <button className="icon-button sidebar-close" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}><X size={19} /></button>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-navigation" aria-label="Main navigation">
          <button className={`nav-item ${panel === "overview" ? "nav-item-active" : ""}`} onClick={() => navigate("overview")}><LayoutDashboard size={18} /><span>Overview</span><ChevronRight className="nav-chevron" size={15} /></button>
          <button className={`nav-item ${panel === "requests" ? "nav-item-active" : ""}`} onClick={() => navigate("requests")}><FileCheck2 size={18} /><span>My requests</span>{activeRequests.length > 0 && <span className="nav-count">{activeRequests.length}</span>}</button>
          <button className={`nav-item ${panel === "services" ? "nav-item-active" : ""}`} onClick={() => navigate("services")}><BriefcaseBusiness size={18} /><span>Browse services</span></button>
        </nav>

        <div className="side-divider" />
        <div className="workspace-label">YOUR ACCOUNT</div>
        <nav className="side-navigation" aria-label="Account">
          <button className="nav-item" onClick={() => setToast("Secure document storage is included with each service request.")}><LockKeyhole size={18} /><span>My documents</span></button>
          {user?.role === "agent" && <button className="nav-item" onClick={() => navigate("requests")}><UsersRound size={18} /><span>Agent workspace</span></button>}
          {user?.role === "admin" &&           <button className={`nav-item ${panel === "admin" ? "nav-item-active" : ""}`} onClick={() => navigate("admin")}><UsersRound size={18} /><span>Administration</span></button>}
          <button className="nav-item" onClick={() => setToast("Our support team is here to help with your application.")}><CircleHelp size={18} /><span>Help & support</span></button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help-card">
            <div className="help-card-icon"><Sparkles size={16} /></div>
            <p>Need a hand?</p>
            <span>Our local experts are just a message away.</span>
            <button onClick={() => setToast("Support is available Monday to Saturday, 9 am–6 pm.")}>Talk to support <ArrowRight size={14} /></button>
          </div>
          <div className="sidebar-footer"><ShieldCheck size={15} /><span>Your information is kept private</span></div>
        </div>
      </aside>

      <section className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="Open menu" onClick={() => setMobileMenuOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{panel === "overview" ? "Overview" : panel === "requests" ? "My requests" : panel === "admin" ? "Administration" : "Services"}</strong></div>
          <div className="topbar-right">
            <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search services..." aria-label="Search services" /><kbd>⌘ K</kbd></label>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setToast("You’re all caught up on notifications.")}><Bell size={19} /><span /></button>
            <div className="topbar-separator" />
            {user ? (
              <button className="profile-button" onClick={signOut} title="Sign out"><span className="avatar">{userInitials}</span><span className="profile-name">{user.name.split(" ")[0]}</span><ChevronDown size={15} /></button>
            ) : (
              <button className="topbar-sign-in" onClick={() => openAuth()}>Sign in <ArrowUpRight size={15} /></button>
            )}
          </div>
        </header>

        <div className="page-content">
          {panel === "overview" && (
            <>
              <section className="welcome-row">
                <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR PAPERWORK, MADE SIMPLE</div><h1>Good morning{user ? `, ${user.name.split(" ")[0]}` : ""} <span className="wave">✳</span></h1><p>We’re here to make life’s important paperwork feel a little easier.</p></div>
                <div className="welcome-actions"><span className="location-chip"><MapPin size={15} /> Pune, Maharashtra <ChevronDown size={14} /></span><button className="primary-button" onClick={() => navigate("services")}><Plus size={17} /> New request</button></div>
              </section>
              {!user && <div className="demo-notice preview-notice"><Sparkles size={16} /><span><b>Preview data:</b> Example activity shows how your workspace will look after signing in.</span><button onClick={() => openAuth()}>Sign in</button></div>}

              <section className="hero-card">
                <div className="hero-copy">
                  <div className="hero-kicker"><Sparkles size={14} /> A simpler way forward</div>
                  <h2>Big life moment?<br /><span>We’ll handle the paperwork.</span></h2>
                  <p>Trusted local experts to help you apply, prepare documents, and stay on track.</p>
                  <button className="hero-button" onClick={() => navigate("services")}>Explore services <ArrowRight size={16} /></button>
                  <div className="hero-trust"><div className="avatar-stack"><span>PS</span><span>AR</span><span>MK</span></div><span><b>2,400+</b> applications made easier</span></div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="art-sun" />
                  <div className="art-spark art-spark-one">✳</div><div className="art-spark art-spark-two">✦</div>
                  <div className="paper paper-back"><div /><div /><div /></div>
                  <div className="paper paper-front"><div className="paper-seal"><ShieldCheck size={21} /></div><div className="paper-lines"><i /><i /><i /></div><div className="paper-check"><Check size={17} /></div></div>
                  <div className="art-stamp"><ShieldCheck size={13} /> VERIFIED HELP</div>
                  <div className="art-orbit" />
                </div>
                <div className="hero-bottom-note"><ShieldCheck size={15} /> Guidance from verified local agents. Always.</div>
              </section>

              <section className="stats-grid" aria-label="Request summary">
                <div className="stat-card"><div className="stat-icon stat-icon-sage"><FileText size={18} /></div><div className="stat-content"><span>ACTIVE REQUESTS</span><div><strong>{user ? activeRequests.length : "2"}</strong><span className="stat-trend"><ArrowUpRight size={13} /> On track</span></div></div><div className="stat-sparkline sparkline-green"><i /><i /><i /><i /><i /><i /><i /></div></div>
                <div className="stat-card"><div className="stat-icon stat-icon-lilac"><Check size={18} /></div><div className="stat-content"><span>COMPLETED</span><div><strong>{user ? completedRequests : "8"}</strong><span className="stat-caption">All time</span></div></div><div className="stat-sparkline sparkline-purple"><i /><i /><i /><i /><i /><i /><i /></div></div>
                <div className="stat-card"><div className="stat-icon stat-icon-amber"><Clock3 size={18} /></div><div className="stat-content"><span>AVERAGE TURNAROUND</span><div><strong>5.2 <small>days</small></strong><span className="stat-trend"><ArrowDownRight size={13} /> 1.4 days faster</span></div></div><div className="stat-sparkline sparkline-amber"><i /><i /><i /><i /><i /><i /><i /></div></div>
              </section>

              <section className="services-section">
                <div className="section-heading"><div><div className="section-overline">HERE FOR THE IMPORTANT THINGS</div><h2>What can we help with?</h2><p>Practical help for the things life asks of you.</p></div><button className="text-button" onClick={() => navigate("services")}>All services <ArrowRight size={15} /></button></div>
                <div className="service-grid">
                  {services.slice(0, 4).map((service) => <ServiceCard key={service.slug} service={service} onSelect={beginRequest} />)}
                </div>
              </section>

              <section className="bottom-grid">
                <div className="requests-card">
                  <div className="card-heading"><div><div className="section-overline">KEEP AN EYE ON THINGS</div><h2>Recent requests</h2></div><button className="text-button" onClick={() => navigate("requests")}>View all <ArrowRight size={14} /></button></div>
                  <div className="request-table">
                    <div className="request-table-head"><span>SERVICE</span><span>REQUESTED</span><span>STATUS</span><span /></div>
                    {requests.slice(0, 3).map((request) => <RequestRow key={request._id} request={request} onClick={() => navigate("requests")} />)}
                  </div>
                </div>
                <div className="help-card-main">
                  <div className="help-card-orb"><CircleHelp size={21} /></div><span className="section-overline">HERE FOR YOU</span><h3>Not sure where to start?</h3><p>Tell us what you need. We’ll help you find the right service and prepare the right documents.</p><button onClick={() => setToast("Tell us what you're trying to get done and our team will point you in the right direction.")}>Talk to a real person <ArrowRight size={15} /></button><div className="help-decoration">✳</div>
                </div>
              </section>
            </>
          )}

          {panel === "services" && (
            <section className="catalog-panel">
              <div className="catalog-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> A LITTLE HELP GOES A LONG WAY</div><h1>Services, made simpler.</h1><p>Clear prices, local support, and someone to guide you at every step.</p></div><div className="catalog-illustration"><FileCheck2 size={54} strokeWidth={1.2} /><Sparkles className="catalog-sparkle" size={22} /></div></div>
              <div className="catalog-toolbar"><div><span className="catalog-count">{visibleServices.length} helpful services</span><span className="catalog-subtitle">· Fees shown upfront, no surprises</span></div><span className="catalog-trust"><ShieldCheck size={15} /> Verified local agents</span></div>
              <div className="service-grid service-grid-catalog">{visibleServices.map((service) => <ServiceCard key={service.slug} service={service} onSelect={beginRequest} />)}</div>
              {visibleServices.length === 0 && <div className="empty-state"><Search size={27} /><h3>No services found</h3><p>Try another search or browse all available services.</p></div>}
              <div className="fine-print"><LockKeyhole size={14} /> Janseva agents provide procedural assistance. All applications are processed by the relevant government authority.</div>
            </section>
          )}

          {panel === "requests" && (
            <section className="history-panel">
              <div className="history-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR APPLICATIONS, ALL IN ONE PLACE</div><h1>{user?.role === "agent" ? "Your assigned requests." : "A little progress, every day."}</h1><p>See what’s moving, what’s next, and where to get help.</p></div><button className="primary-button" onClick={() => navigate("services")}><Plus size={17} /> New request</button></div>
              {!user && <div className="demo-notice"><Sparkles size={17} /><span><b>Preview mode:</b> These example requests show how your progress will look when you sign in.</span><button onClick={() => openAuth()}>Sign in</button></div>}
              <div className="history-summary">{user?.role === "agent" ? <><div><span>ASSIGNED REQUESTS</span><strong>{requests.filter((request) => !request.canAccept).length}</strong></div><div><span>OPEN REQUESTS</span><strong>{requests.filter((request) => request.canAccept).length}</strong></div><div><span>COMPLETED</span><strong>{completedRequests}</strong></div><div><span>EST. COMPLETED EARNINGS</span><strong>{formatMoney(requests.filter((request) => request.status === "completed").reduce((total, request) => total + (request.assistanceFee ?? 0), 0))}</strong></div></> : <><div><span>ALL REQUESTS</span><strong>{requests.length}</strong></div><div><span>IN PROGRESS</span><strong>{activeRequests.length}</strong></div><div><span>COMPLETED</span><strong>{completedRequests}</strong></div><div><span>NEED YOUR ATTENTION</span><strong>{requests.filter((request) => request.status === "documents_required").length}</strong></div></>}</div>
              <div className="history-list">
                {user?.role === "agent" && user.verificationStatus !== "verified" && <div className="demo-notice"><Clock3 size={17} /><span>Your agent profile is being reviewed. Request access will open once your verification is complete.</span></div>}
                {requests.map((request) => <div className="history-item" key={request._id}><div className={`history-icon ${request.status === "completed" ? "history-icon-done" : ""}`}><FileText size={19} /></div><div className="history-main"><div className="history-service-name">{request.serviceName}<span className={statusClass(request.status)}>{statusNames[request.status] ?? request.status}</span></div><div className="history-meta"><span>{request.reference}</span>{request.applicantName && <><span>·</span><span>For {request.applicantName}</span></>}<span>·</span><span>{formatDate(request.createdAt)}</span></div></div><div className="history-agent">{request.assignedAgent ? <><span className="mini-avatar">{request.assignedAgent.name.split(" ").map((part) => part[0]).join("")}</span><span>{request.assignedAgent.name}</span></> : request.canAccept ? <span className="agent-pending"><UsersRound size={14} /> Open request</span> : <span className="agent-pending"><Clock3 size={14} /> Finding an agent</span>}</div><div className="history-price">{formatMoney(request.quotedTotal)}</div>{user?.role === "agent" && request.canAccept ? <button className="accept-request-button" disabled={acceptingId === request._id} onClick={() => void acceptRequest(request)}>{acceptingId === request._id ? "Accepting…" : "Accept"}</button> : <button className="icon-button history-more" aria-label={`View ${request.reference}`} onClick={() => setDetailRequest(request)}><ChevronRight size={18} /></button>}</div>)}
                {requests.length === 0 && <div className="empty-state"><FileText size={27} /><h3>No requests yet</h3><p>When you request help, you’ll find updates and documents here.</p><button className="primary-button" onClick={() => navigate("services")}>Explore services <ArrowRight size={15} /></button></div>}
              </div>
            </section>
          )}

          {panel === "admin" && user?.role === "admin" && <AdminPanel requests={requests} services={services} onServicesChange={setServices} onNotice={setToast} />}
          {panel === "admin" && user?.role !== "admin" && <section className="history-panel"><div className="empty-state"><LockKeyhole size={27} /><h3>Administrator access required</h3><p>Sign in with an administrator account to manage the platform.</p></div></section>}

          <footer className="page-footer"><span>© 2026 Janseva Services</span><span>Thoughtful help for everyday paperwork <span className="footer-heart">♥</span></span><span><ShieldCheck size={14} /> Your information stays yours</span></footer>
        </div>
      </section>

      {requestOpen && selectedService && <RequestModal service={selectedService} busy={requestBusy} error={error} onClose={() => { setRequestOpen(false); setError(""); }} onSubmit={submitRequest} />}
      {submissionConfirmation && <RequestConfirmationModal request={submissionConfirmation} onClose={() => setSubmissionConfirmation(null)} />}
      {authOpen && <AuthModal mode={authMode} role={authRole} busy={authBusy} error={error} onClose={() => { setAuthOpen(false); setError(""); }} onMode={setAuthMode} onRole={setAuthRole} onSubmit={submitAuth} />}
      {detailRequest && <RequestDetailsModal request={detailRequest} user={user} onClose={() => setDetailRequest(null)} onUpdated={async () => { await loadRequests(); setDetailRequest(null); }} onNotice={setToast} />}
      {toast && <div className="toast"><div className="toast-check"><Check size={14} /></div><span>{toast}</span><button aria-label="Dismiss" onClick={() => setToast("")}><X size={16} /></button></div>}
    </main>
  );
}

function ServiceCard({ service, onSelect }: { service: ServiceInfo; onSelect: (service: ServiceInfo) => void }) {
  const Icon = serviceIcons[service.icon as keyof typeof serviceIcons] ?? FileText;
  return (
    <button className="service-card" onClick={() => onSelect(service)}>
      <div className={`service-icon icon-${service.color}`}><Icon size={21} strokeWidth={1.8} /></div>
      <span className="service-category">{service.category}</span>
      <h3>{service.name}</h3>
      <p>{service.description}</p>
      <div className="service-card-bottom"><span>From <strong>{formatMoney(service.governmentFee + service.assistanceFee)}</strong></span><span className="service-arrow"><ArrowUpRight size={16} /></span></div>
    </button>
  );
}

function RequestRow({ request, onClick }: { request: ServiceRequest; onClick: () => void }) {
  return (
    <button className="request-row" onClick={onClick}>
      <span className="request-service-cell"><span className="request-doc-icon"><FileText size={16} /></span><span><b>{request.serviceName}</b><small>{request.reference}</small></span></span>
      <span className="request-date-cell">{formatDate(request.createdAt)}</span>
      <span><span className={statusClass(request.status)}><span className="status-dot" />{statusNames[request.status] ?? request.status}</span></span>
      <ChevronRight size={17} className="row-chevron" />
    </button>
  );
}

function RequestModal({ service, busy, error, onClose, onSubmit }: { service: ServiceInfo; busy: boolean; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const total = service.governmentFee + service.assistanceFee;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal request-modal" role="dialog" aria-modal="true" aria-labelledby="request-title">
        <div className="modal-top"><div className="modal-icon modal-icon-green"><FileCheck2 size={20} /></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
        <div className="modal-title-row"><div><div className="section-overline">LET’S GET YOU STARTED</div><h2 id="request-title">Request a service</h2><p>{service.name} · About {service.estimatedDays} working days</p></div></div>
        <form onSubmit={onSubmit}>
          <div className="form-grid"><label className="form-field"><span>Applicant’s full name</span><input name="applicantName" required minLength={2} maxLength={100} placeholder="As it appears on your ID" autoComplete="name" /></label><label className="form-field"><span>Mobile number</span><input name="contactPhone" type="tel" required minLength={8} maxLength={24} placeholder="+91 98765 43210" autoComplete="tel" /></label></div>
          <label className="form-field"><span>City / area</span><input name="location" required minLength={2} maxLength={200} placeholder="Your city, neighbourhood or PIN code" /></label>
          <label className="form-field"><span>Anything else we should know <small>Optional</small></span><textarea name="notes" rows={2} maxLength={1000} placeholder="Share any helpful context for your local expert" /></label>
          <div className="form-field">
            <span>Documents for {service.name} <small>PDF, JPG or PNG · Up to 10 MB each</small></span>
            <div className="document-checklist">
              {service.requiredDocuments.map((document, index) => (
                <label className="form-field" key={document}>
                  <span>{document} <small>Optional — you can submit this later</small></span>
                  <input
                    name={`requiredDocument-${index}`}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  />
                </label>
              ))}
            </div>
            <label className="form-field">
              <span>Other supporting documents <small>Optional</small></span>
              <input name="documents" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple />
            </label>
            <small className="field-hint">Your files are stored privately and only shared with the people handling your application.</small>
          </div>
          <div className="price-breakdown"><span><span>Government fee</span><span>{formatMoney(service.governmentFee)}</span></span><span><span>Agent assistance</span><span>{formatMoney(service.assistanceFee)}</span></span><span className="price-total"><strong>Total estimate</strong><strong>{formatMoney(total)}</strong></span></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Not now</button><button className="primary-button" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> Sending request…</> : <>Send request <ArrowRight size={16} /></>}</button></div>
          <p className="modal-footnote"><ShieldCheck size={14} /> No payment required to request help. The final government fee may vary.</p>
        </form>
      </section>
    </div>
  );
}

function RequestConfirmationModal({
  request,
  onClose,
}: {
  request: { reference: string; serviceName: string; status: string };
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal request-modal" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
        <div className="modal-top">
          <div className="modal-icon modal-icon-green"><Check size={20} /></div>
          <button className="icon-button" aria-label="Close confirmation" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="auth-heading">
          <div className="section-overline">REQUEST RECEIVED</div>
          <h2 id="confirmation-title">Your request is submitted.</h2>
          <p>We’ve received your service request. Save the reference below for your records.</p>
        </div>
        <div className="detail-section">
          <div className="section-overline">SERVICE TYPE</div>
          <h3>{request.serviceName}</h3>
        </div>
        <div className="detail-section">
          <div className="section-overline">REQUEST REFERENCE</div>
          <h3>{request.reference}</h3>
          <p><span className={statusClass(request.status)}>{statusNames[request.status] ?? request.status}</span></p>
        </div>
        <p className="detail-muted">This guest request is not linked to an account, so it will not appear in request history. Keep your reference if you need to contact support.</p>
        <div className="modal-actions">
          <button className="primary-button" type="button" onClick={onClose}>Done <Check size={16} /></button>
        </div>
      </section>
    </div>
  );
}

function AuthModal({ mode, role, busy, error, onClose, onMode, onRole, onSubmit }: { mode: AuthMode; role: "citizen" | "agent"; busy: boolean; error: string; onClose: () => void; onMode: (mode: AuthMode) => void; onRole: (role: "citizen" | "agent") => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="modal-top"><div className="brand-mark"><ShieldCheck size={21} /></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
        <div className="auth-heading"><div className="section-overline">{mode === "login" ? "GOOD TO HAVE YOU BACK" : "LET’S MAKE PAPERWORK EASIER"}</div><h2 id="auth-title">{mode === "login" ? "Welcome back." : "A little less paperwork."}</h2><p>{mode === "login" ? "Sign in to see how things are going." : "Create your Janseva account in a moment—no email verification or OTP needed."}</p></div>
        {mode === "register" && <div className="account-type-switch"><button className={role === "citizen" ? "account-type-active" : ""} onClick={() => onRole("citizen")} type="button">I need help</button><button className={role === "agent" ? "account-type-active" : ""} onClick={() => onRole("agent")} type="button">I’m an agent</button></div>}
        <form onSubmit={onSubmit}>
          {mode === "register" && <label className="form-field"><span>Full name</span><input name="name" required minLength={2} maxLength={100} placeholder="Your name" autoComplete="name" /></label>}
          <label className="form-field"><span>Email address</span><input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
          {mode === "register" && <label className="form-field"><span>Mobile number</span><input name="phone" type="tel" required={role === "agent"} autoComplete="tel" placeholder="+91 98765 43210" /></label>}
          {mode === "register" && role === "agent" && <label className="form-field"><span>Service areas</span><input name="serviceAreas" required placeholder="e.g. Pune, Pimpri-Chinchwad" /><small className="field-hint">Separate areas with commas. Your profile is reviewed before you can accept requests.</small></label>}
          <label className="form-field"><span>Password {mode === "register" && <small>At least 8 characters</small>}</span><input name="password" type="password" required minLength={mode === "register" ? 8 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="••••••••" /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> Please wait…</> : mode === "login" ? <>Sign in securely <ArrowRight size={16} /></> : <>Create account <ArrowRight size={16} /></>}</button>
        </form>
        <div className="auth-switch">{mode === "login" ? <>New around here? <button onClick={() => onMode("register")}>Create an account</button></> : <>Already have an account? <button onClick={() => onMode("login")}>Sign in</button></>}</div>
        <p className="modal-footnote"><LockKeyhole size={14} /> Your personal details are encrypted and kept private.</p>
      </section>
    </div>
  );
}

function RequestDetailsModal({ request, user, onClose, onUpdated, onNotice }: { request: ServiceRequest; user: User | null; onClose: () => void; onUpdated: () => Promise<void>; onNotice: (message: string) => void }) {
  const [nextStatus, setNextStatus] = useState(request.status);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintBusy, setComplaintBusy] = useState(false);
  const canUpdate = user?.role === "admin" || (user?.role === "agent" && user.verificationStatus === "verified" && !request.canAccept);
  const nextStatuses = user?.role === "agent"
    ? request.status === "accepted"
      ? ["in_progress", "documents_required", "rejected"]
      : request.status === "under_review"
        ? ["in_progress", "documents_required", "rejected"]
        : request.status === "in_progress"
          ? ["documents_required", "completed", "rejected"]
          : request.status === "documents_required"
            ? ["in_progress", "rejected"]
            : []
    : ["under_review", "accepted", "in_progress", "documents_required", "completed", "rejected", "cancelled"];

  async function uploadDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadBusy(true);
    try {
      const response = await fetch(`/api/requests/${request._id}/documents`, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const data = (await response.json()) as { documents?: { id: string }[]; error?: string };
      if (!response.ok || !data.documents) throw new Error(data.error ?? "Documents could not be uploaded.");
      onNotice(`${data.documents.length} document${data.documents.length === 1 ? "" : "s"} uploaded securely.`);
      await onUpdated();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Documents could not be uploaded.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function submitComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setComplaintBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request._id,
          subject: form.get("subject"),
          description: form.get("description"),
        }),
      });
      const data = (await response.json()) as { complaint?: { reference: string }; error?: string };
      if (!response.ok || !data.complaint) throw new Error(data.error ?? "Your complaint could not be submitted.");
      onNotice(`Concern ${data.complaint.reference} sent to our support team.`);
      setComplaintOpen(false);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Your complaint could not be submitted.");
    } finally {
      setComplaintBusy(false);
    }
  }

  async function updateStatus() {
    setBusy(true);
    try {
      const response = await fetch(`/api/requests/${request._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Request status could not be updated.");
      onNotice(`Request status updated to ${statusNames[nextStatus] ?? nextStatus}.`);
      await onUpdated();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Request status could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="modal-top"><div className="modal-icon modal-icon-green"><FileCheck2 size={20} /></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
        <div className="detail-heading"><div><div className="section-overline">REQUEST {request.reference}</div><h2 id="detail-title">{request.serviceName}</h2><p>Submitted {formatDate(request.createdAt)} · {formatMoney(request.quotedTotal)}</p></div><span className={statusClass(request.status)}>{statusNames[request.status] ?? request.status}</span></div>
        <div className="detail-section"><div className="section-overline">APPLICATION PROGRESS</div><div className="timeline-list">{request.timeline && request.timeline.length > 0 ? [...request.timeline].reverse().map((entry, index) => <div className={`timeline-item ${index === 0 ? "timeline-item-current" : ""}`} key={`${entry.status}-${entry.createdAt ?? index}`}><span className="timeline-marker">{index === 0 ? <Check size={11} /> : null}</span><div><b>{statusNames[entry.status] ?? entry.status.replaceAll("_", " ")}</b><p>{entry.note}</p>{entry.createdAt && <small>{formatDate(entry.createdAt)}</small>}</div></div>) : <div className="timeline-empty"><Clock3 size={15} /> Request updates will appear here.</div>}</div></div>
        <div className="detail-section"><div className="detail-section-heading"><div className="section-overline">YOUR DOCUMENTS</div>{request.documents && request.documents.length > 0 && <span>{request.documents.length} file{request.documents.length === 1 ? "" : "s"}</span>}</div>{request.documents && request.documents.length > 0 ? <div className="document-list">{request.documents.map((document) => <a className="document-row" href={`/api/requests/${request._id}/documents/${document._id}`} key={document._id}><span className="request-doc-icon"><FileText size={16} /></span><span><b>{document.documentType ?? document.originalName}</b><small>{document.documentType ? `${document.originalName} · ` : ""}{document.mimeType} · {(document.size / (1024 * 1024)).toFixed(1)} MB</small></span><Download size={16} /></a>)}</div> : <p className="detail-muted">Documents added to this application will be listed here.</p>}</div>
        {user && !request.canAccept && <div className="detail-upload"><form onSubmit={(event) => void uploadDocuments(event)}><label className="form-field"><span>Add documents <small>PDF, JPG or PNG · up to 10 MB each</small></span><input name="documents" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple required /></label><button className="secondary-button" type="submit" disabled={uploadBusy}>{uploadBusy ? "Uploading…" : "Upload"}</button></form></div>}
        {canUpdate && nextStatuses.length > 0 && <div className="detail-update"><label className="form-field"><span>Update progress</span><select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>{nextStatuses.map((status) => <option key={status} value={status}>{statusNames[status] ?? status}</option>)}</select></label><button className="primary-button" disabled={busy || nextStatus === request.status} onClick={() => void updateStatus()}>{busy ? "Saving…" : "Save update"}</button></div>}
        {user?.role === "citizen" && !request._id.startsWith("demo-") && <div className="complaint-form-section"><button className="complaint-toggle" onClick={() => setComplaintOpen(!complaintOpen)}><CircleHelp size={15} /> {complaintOpen ? "Close support form" : "Something not right? Raise a concern"}</button>{complaintOpen && <form className="complaint-form" onSubmit={(event) => void submitComplaint(event)}><label className="form-field"><span>What is this about?</span><select name="subject" required><option value="service_issue">Service issue</option><option value="delay">Application delay</option><option value="document_concern">Document concern</option><option value="payment">Fee or payment question</option><option value="other">Something else</option></select></label><label className="form-field"><span>Tell us a little more</span><textarea name="description" rows={3} minLength={10} maxLength={2000} required placeholder="Share what happened and how we can help." /></label><button className="primary-button" type="submit" disabled={complaintBusy}>{complaintBusy ? "Sending…" : "Send to support"}</button></form>}</div>}
        <p className="modal-footnote"><ShieldCheck size={14} /> Documents are only available to you and the people handling this application.</p>
      </section>
    </div>
  );
}

type AgentRecord = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  serviceAreas: string[];
  verificationStatus?: "pending" | "verified" | "rejected";
};

type ComplaintRecord = {
  _id: string;
  reference: string;
  subject: string;
  description: string;
  status: "open" | "investigating" | "escalated" | "resolved" | "closed";
  createdAt: string;
  citizen?: { name: string; email?: string };
  serviceRequest?: { reference: string; serviceName: string; status: string };
};

function AdminPanel({ requests, services, onServicesChange, onNotice }: { requests: ServiceRequest[]; services: ServiceInfo[]; onServicesChange: (services: ServiceInfo[]) => void; onNotice: (message: string) => void }) {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [agentError, setAgentError] = useState("");
  const [complaintError, setComplaintError] = useState("");
  const [savingSlug, setSavingSlug] = useState("");
  const [decisionId, setDecisionId] = useState("");
  const [complaintId, setComplaintId] = useState("");
  const completed = requests.filter((request) => request.status === "completed").length;
  const completionRate = requests.length > 0 ? Math.round((completed / requests.length) * 100) : 0;

  async function loadAgents() {
    const response = await fetch("/api/admin/agents", { cache: "no-store" });
    const data = (await response.json()) as { agents?: AgentRecord[]; error?: string };
    if (!response.ok || !data.agents) throw new Error(data.error ?? "Agent records could not be loaded.");
    setAgents(data.agents);
    setAgentError("");
  }

  async function loadComplaints() {
    const response = await fetch("/api/admin/complaints", { cache: "no-store" });
    const data = (await response.json()) as { complaints?: ComplaintRecord[]; error?: string };
    if (!response.ok || !data.complaints) throw new Error(data.error ?? "Complaint records could not be loaded.");
    setComplaints(data.complaints);
    setComplaintError("");
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/agents", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { agents?: AgentRecord[]; error?: string };
        if (!response.ok || !data.agents) throw new Error(data.error ?? "Agent records could not be loaded.");
        if (active) setAgents(data.agents);
      })
      .catch((error: unknown) => {
        if (active) setAgentError(error instanceof Error ? error.message : "Agent records could not be loaded.");
      });
    fetch("/api/admin/complaints", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { complaints?: ComplaintRecord[]; error?: string };
        if (!response.ok || !data.complaints) throw new Error(data.error ?? "Complaint records could not be loaded.");
        if (active) setComplaints(data.complaints);
      })
      .catch((error: unknown) => {
        if (active) setComplaintError(error instanceof Error ? error.message : "Complaint records could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function updateAgent(agentId: string, verificationStatus: "verified" | "rejected") {
    setDecisionId(agentId);
    try {
      const response = await fetch("/api/admin/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, verificationStatus }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Agent verification could not be updated.");
      onNotice(verificationStatus === "verified" ? "Agent verified. They can now accept requests." : "Agent application declined.");
      await loadAgents();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Agent verification could not be updated.");
    } finally {
      setDecisionId("");
    }
  }

  async function updateComplaint(complaint: ComplaintRecord, status: "investigating" | "escalated" | "resolved") {
    setComplaintId(complaint._id);
    try {
      const response = await fetch("/api/admin/complaints", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId: complaint._id, status }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Complaint status could not be updated.");
      onNotice(`Complaint ${complaint.reference} marked ${status}.`);
      await loadComplaints();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Complaint status could not be updated.");
    } finally {
      setComplaintId("");
    }
  }

  async function updateService(event: FormEvent<HTMLFormElement>, service: ServiceInfo) {
    event.preventDefault();
    setSavingSlug(service.slug);
    const form = new FormData(event.currentTarget);
    const payload = {
      slug: service.slug,
      name: String(form.get("name") ?? ""),
      category: String(form.get("category") ?? ""),
      description: String(form.get("description") ?? ""),
      requiredDocuments: String(form.get("requiredDocuments") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
      governmentFee: Number(form.get("governmentFee")),
      assistanceFee: Number(form.get("assistanceFee")),
      estimatedDays: Number(form.get("estimatedDays")),
    };
    try {
      const response = await fetch("/api/admin/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { service?: ServiceInfo; error?: string };
      if (!response.ok || !data.service) throw new Error(data.error ?? "Service details could not be updated.");
      onServicesChange(services.map((item) => item.slug === service.slug ? data.service ?? item : item));
      onNotice(`${data.service.name} details saved.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Service details could not be updated.");
    } finally {
      setSavingSlug("");
    }
  }

  return (
    <section className="admin-panel">
      <div className="history-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR PLATFORM AT A GLANCE</div><h1>Good work starts here.</h1><p>Keep service partners supported and the details up to date.</p></div><span className="catalog-trust"><ShieldCheck size={15} /> Admin workspace</span></div>
      <div className="history-summary"><div><span>TOTAL REQUESTS</span><strong>{requests.length}</strong></div><div><span>COMPLETED</span><strong>{completed}</strong></div><div><span>COMPLETION RATE</span><strong>{completionRate}%</strong></div><div><span>VERIFIED AGENTS</span><strong>{agents.filter((agent) => agent.verificationStatus === "verified").length}</strong></div></div>

      <section className="admin-section">
        <div className="admin-section-heading"><div><div className="section-overline">A GREAT EXPERIENCE STARTS WITH A GREAT PARTNER</div><h2>Agent verification</h2><p>Review agent applications before they can accept citizen requests.</p></div><button className="secondary-button" onClick={() => void loadAgents()}>Refresh</button></div>
        {agentError && <div className="form-error admin-error" role="alert">{agentError}</div>}
        {agents.length > 0 ? <div className="agent-list">{agents.map((agent) => <div className="agent-row" key={agent._id}><div className="mini-avatar">{agent.name.split(" ").map((part) => part[0]).join("")}</div><div className="agent-row-main"><b>{agent.name}</b><span>{agent.email}{agent.phone ? ` · ${agent.phone}` : ""}</span><small>{agent.serviceAreas.join(" · ")}</small></div><span className={statusClass(agent.verificationStatus ?? "pending")}>{agent.verificationStatus ?? "pending"}</span>{agent.verificationStatus === "pending" ? <div className="agent-actions"><button className="agent-approve" disabled={decisionId === agent._id} onClick={() => void updateAgent(agent._id, "verified")}>Approve</button><button className="agent-reject" disabled={decisionId === agent._id} onClick={() => void updateAgent(agent._id, "rejected")}>Decline</button></div> : <span className="agent-reviewed"><ShieldCheck size={15} /></span>}</div>)}</div> : !agentError ? <div className="admin-empty"><UsersRound size={20} /> No agent applications yet.</div> : null}
      </section>

      <section className="admin-section">
        <div className="admin-section-heading"><div><div className="section-overline">WE’RE LISTENING</div><h2>Complaints & escalations</h2><p>Review concerns and keep citizens informed about the next step.</p></div><button className="secondary-button" onClick={() => void loadComplaints()}>Refresh</button></div>
        {complaintError && <div className="form-error admin-error" role="alert">{complaintError}</div>}
        {complaints.length > 0 ? <div className="complaint-list">{complaints.map((complaint) => <div className="complaint-row" key={complaint._id}><div className="complaint-row-top"><div><span className="section-overline">{complaint.reference} · {complaint.subject.replaceAll("_", " ")}</span><h3>{complaint.serviceRequest?.serviceName ?? "Service request"}</h3><p>{complaint.description}</p><small>{complaint.citizen?.name ?? "Citizen"} · {complaint.serviceRequest?.reference ?? "Request"} · {formatDate(complaint.createdAt)}</small></div><span className={statusClass(complaint.status)}>{complaint.status}</span></div>{!["resolved", "closed"].includes(complaint.status) && <div className="complaint-actions">{complaint.status !== "investigating" && <button disabled={complaintId === complaint._id} onClick={() => void updateComplaint(complaint, "investigating")}>Investigate</button>}{complaint.status !== "escalated" && <button disabled={complaintId === complaint._id} onClick={() => void updateComplaint(complaint, "escalated")}>Escalate</button>}<button className="complaint-resolve" disabled={complaintId === complaint._id} onClick={() => void updateComplaint(complaint, "resolved")}>Resolve</button></div>}</div>)}</div> : !complaintError ? <div className="admin-empty"><CircleHelp size={20} /> No complaints need your attention.</div> : null}
      </section>

      <section className="admin-section">
        <div className="admin-section-heading"><div><div className="section-overline">CLEAR FEES BUILD TRUST</div><h2>Service pricing & details</h2><p>Update assistance fees, government fee guidance, and document checklists.</p></div></div>
        <div className="admin-service-list">{services.map((service) => <form className="admin-service-form" key={service.slug} onSubmit={(event) => void updateService(event, service)}><div className="admin-service-title"><div><b>{service.name}</b><span>{service.slug}</span></div><button className="secondary-button" type="submit" disabled={savingSlug === service.slug}>{savingSlug === service.slug ? "Saving…" : "Save changes"}</button></div><div className="admin-service-fields"><label className="form-field"><span>Service name</span><input name="name" defaultValue={service.name} required maxLength={100} /></label><label className="form-field"><span>Category</span><input name="category" defaultValue={service.category} required maxLength={100} /></label><label className="form-field"><span>Government fee (₹)</span><input name="governmentFee" type="number" min="0" max="10000000" step="1" defaultValue={service.governmentFee} required /></label><label className="form-field"><span>Assistance fee (₹)</span><input name="assistanceFee" type="number" min="0" max="10000000" step="1" defaultValue={service.assistanceFee} required /></label><label className="form-field"><span>Estimated days</span><input name="estimatedDays" type="number" min="1" max="365" step="1" defaultValue={service.estimatedDays} required /></label></div><label className="form-field admin-documents-field"><span>Description</span><textarea name="description" rows={2} defaultValue={service.description} maxLength={1000} required /></label><label className="form-field admin-documents-field"><span>Required documents <small>One item per line</small></span><textarea name="requiredDocuments" rows={2} defaultValue={service.requiredDocuments.join("\n")} /></label></form>)}</div>
      </section>
    </section>
  );
}
