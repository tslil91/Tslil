import { useEffect, useState } from 'react';
import { Rail, type Route } from './components/Rail';
import { Toast } from './components/Toast';
import { BilletsView } from './views/billets/BilletsView';
import { GrantsView } from './views/grants/GrantsView';
import { OverviewView } from './views/overview/OverviewView';
import { PeopleView } from './views/people/PeopleView';
import { SimulatorView } from './views/simulator/SimulatorView';

const ROUTES: Route[] = ['people', 'billets', 'grants', 'overview', 'simulator'];
const parse = (): Route => {
  const r = window.location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(r) ? r : 'people';
};

/** Hash routing keeps the demo a static site (no server rewrites needed). */
function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  return (
    <div dir="rtl" className="flex h-full min-w-[1024px] overflow-hidden bg-bg">
      <Rail current={route} />
      <main className="flex min-w-0 flex-1 flex-col">
        {route === 'people' && <PeopleView />}
        {route === 'billets' && <BilletsView />}
        {route === 'grants' && <GrantsView />}
        {route === 'overview' && <OverviewView />}
        {route === 'simulator' && <SimulatorView />}
      </main>
      <Toast />
    </div>
  );
}
