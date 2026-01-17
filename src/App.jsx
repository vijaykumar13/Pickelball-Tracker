import { AuthProvider } from './contexts/AuthContext';
import PickleballTracker from './PickleballTracker';

function App() {
  return (
    <AuthProvider>
      <PickleballTracker />
    </AuthProvider>
  );
}

export default App;
