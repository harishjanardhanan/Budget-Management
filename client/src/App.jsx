import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Categories from './pages/Categories';
import Budgets from './pages/Budgets';
import Recurring from './pages/Recurring';
import Reports from './pages/Reports';
import Navbar from './components/Navbar';
import './index.css';

function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
                <div className="skeleton" style={{ width: '200px', height: '200px', borderRadius: '50%' }}></div>
            </div>
        );
    }

    return isAuthenticated ? children : <Navigate to="/login" />;
}

function AppRoutes() {
    const { isAuthenticated } = useAuth();

    return (
        <>
            {isAuthenticated && <Navbar />}
            <Routes>
                <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/transactions"
                    element={
                        <ProtectedRoute>
                            <Transactions />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/categories"
                    element={
                        <ProtectedRoute>
                            <Categories />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/budgets"
                    element={
                        <ProtectedRoute>
                            <Budgets />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/recurring"
                    element={
                        <ProtectedRoute>
                            <Recurring />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/reports"
                    element={
                        <ProtectedRoute>
                            <Reports />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
