import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Home from '@/pages/Home';
import Browse from '@/pages/Browse';
import Detail from '@/pages/Detail';
import Contribute from '@/pages/Contribute';
import Search from '@/pages/Search';
import Admin from '@/pages/Admin';
import MyEntries from '@/pages/MyEntries';
import Edit from '@/pages/Edit';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/browse/:type" element={<Browse />} />
    <Route path="/search" element={<Search />} />
    <Route path="/view/:type/:id" element={<Detail />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/contribute" element={<Contribute />} />
      <Route path="/edit/:type/:id" element={<Edit />} />
      <Route path="/my" element={<MyEntries />} />
      <Route path="/admin" element={<Admin />} />
    </Route>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App