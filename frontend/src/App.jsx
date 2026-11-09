import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Room from "./components/Room.jsx";
import Auth from "./pages/Auth.jsx";
import Lists from "./pages/Lists.jsx";
import ListPage from "./pages/ListPage.jsx";
import Editor from "./pages/Editor.jsx";
import Train from "./pages/Train.jsx";
import Profile from "./pages/Profile.jsx";

function Private() {
  const { user } = useAuth();
  if (user === undefined) return <div className="loading">…</div>;
  return user ? <Outlet /> : <Navigate to="/connexion" replace />;
}

function PublicOnly() {
  const { user } = useAuth();
  if (user === undefined) return <div className="loading">…</div>;
  return user ? <Navigate to="/" replace /> : <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Room />}>
        <Route element={<PublicOnly />}>
          <Route path="/connexion" element={<Auth mode="login" />} />
          <Route path="/inscription" element={<Auth mode="register" />} />
        </Route>
        <Route element={<Private />}>
          <Route path="/" element={<Lists />} />
          <Route path="/listes/nouvelle" element={<Editor />} />
          <Route path="/listes/:id" element={<ListPage />} />
          <Route path="/listes/:id/modifier" element={<Editor />} />
          <Route path="/reviser/:id/:mode/:dir" element={<Train />} />
          <Route path="/profil" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
