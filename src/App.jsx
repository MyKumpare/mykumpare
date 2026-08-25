import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import Analytics from './pages/Analytics';
import UserManagement from './pages/UserManagement';
import OverviewDashboard from './pages/OverviewDashboard';
import ResearchAssistant from './pages/ResearchAssistant';
import AiAgents from './pages/AiAgents';
import DueDiligenceKanban from './pages/DueDiligenceKanban';
import DueDiligenceDashboard from './pages/DueDiligenceDashboard';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import OnboardingGuard from '@/components/onboarding/OnboardingGuard';
import ExternalPartyRegister from './pages/ExternalPartyRegister';
import ExternalParty from './pages/ExternalParty';
import ActivityCalendar from './pages/ActivityCalendar';
import AnalystCoverageReport from './pages/AnalystCoverageReport';
import FirmComparison from './pages/FirmComparison';
import MonitorPage from './pages/MonitorPage';
import PortfolioFundingDashboard from './pages/PortfolioFundingDashboard';
import PortfolioFundingReport from './pages/PortfolioFundingReport';
import SearchReport from './pages/SearchReport';
import ConferenceCalendar from './pages/ConferenceCalendar';
import DuplicateContacts from './pages/DuplicateContacts';
import BoardMeetingCalendar from './pages/BoardMeetingCalendar';
import BoardMeetingDashboard from './pages/BoardMeetingDashboard';
import ActionItemsKanban from './pages/ActionItemsKanban';
import CoverageTracker from './pages/CoverageTracker';
import CoverageManagement from './pages/CoverageManagement';


const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // The public registration page must be reachable by unauthenticated invitees.
  // Exempt it from the auth redirect so pre-fill params from the email link survive.
  const isRegisterRoute = window.location.hash.startsWith('#/register');

  // Handle authentication errors (but allow the /register route through)
  if (authError && !isRegisterRoute) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <>
    {!isRegisterRoute && <OnboardingGuard />}
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}

      <Route path="/Overview" element={<LayoutWrapper currentPageName="Overview"><OverviewDashboard /></LayoutWrapper>} />
      <Route path="/DueDiligenceKanban" element={<LayoutWrapper currentPageName="DueDiligenceKanban"><DueDiligenceKanban /></LayoutWrapper>} />
      <Route path="/DueDiligenceDashboard" element={<LayoutWrapper currentPageName="DueDiligenceDashboard"><DueDiligenceDashboard /></LayoutWrapper>} />
      <Route path="/ResearchAssistant" element={<LayoutWrapper currentPageName="ResearchAssistant"><ResearchAssistant /></LayoutWrapper>} />
      <Route path="/AiAgents" element={<LayoutWrapper currentPageName="AiAgents"><AiAgents /></LayoutWrapper>} />
      <Route path="/Analytics" element={<LayoutWrapper currentPageName="Analytics"><Analytics /></LayoutWrapper>} />
      <Route path="/UserManagement" element={<LayoutWrapper currentPageName="UserManagement"><UserManagement /></LayoutWrapper>} />
      <Route path="/ExternalPortal" element={<LayoutWrapper currentPageName="ExternalPortal"><ExternalParty /></LayoutWrapper>} />
      <Route path="/ActivityCalendar" element={<LayoutWrapper currentPageName="ActivityCalendar"><ActivityCalendar /></LayoutWrapper>} />
      <Route path="/AnalystCoverageReport" element={<LayoutWrapper currentPageName="AnalystCoverageReport"><AnalystCoverageReport /></LayoutWrapper>} />
      <Route path="/FirmComparison" element={<LayoutWrapper currentPageName="FirmComparison"><FirmComparison /></LayoutWrapper>} />
      <Route path="/Monitor" element={<LayoutWrapper currentPageName="Monitor"><MonitorPage /></LayoutWrapper>} />
      <Route path="/PortfolioFundingDashboard" element={<LayoutWrapper currentPageName="PortfolioFundingDashboard"><PortfolioFundingDashboard /></LayoutWrapper>} />
      <Route path="/PortfolioFundingReport" element={<LayoutWrapper currentPageName="PortfolioFundingReport"><PortfolioFundingReport /></LayoutWrapper>} />
      <Route path="/SearchReport" element={<LayoutWrapper currentPageName="SearchReport"><SearchReport /></LayoutWrapper>} />
      <Route path="/ConferenceCalendar" element={<LayoutWrapper currentPageName="ConferenceCalendar"><ConferenceCalendar /></LayoutWrapper>} />
      <Route path="/DuplicateContacts" element={<LayoutWrapper currentPageName="DuplicateContacts"><DuplicateContacts /></LayoutWrapper>} />
      <Route path="/BoardMeetingCalendar" element={<LayoutWrapper currentPageName="BoardMeetingCalendar"><BoardMeetingCalendar /></LayoutWrapper>} />
      <Route path="/BoardMeetingDashboard" element={<LayoutWrapper currentPageName="BoardMeetingDashboard"><BoardMeetingDashboard /></LayoutWrapper>} />
      <Route path="/ActionItemsKanban" element={<LayoutWrapper currentPageName="ActionItemsKanban"><ActionItemsKanban /></LayoutWrapper>} />
      <Route path="/CoverageTracker" element={<LayoutWrapper currentPageName="CoverageTracker"><CoverageTracker /></LayoutWrapper>} />
      <Route path="/CoverageManagement" element={<LayoutWrapper currentPageName="CoverageManagement"><CoverageManagement /></LayoutWrapper>} />
      <Route path="/register" element={<ExternalPartyRegister />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App