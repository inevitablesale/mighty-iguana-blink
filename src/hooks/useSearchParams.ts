import { useSearchParams as useRouterSearchParams } from "react-router-dom";

export function useSearchParams() {
  const [searchParams] = useRouterSearchParams();
  return {
    isInitialView: searchParams.get('view') === 'initial',
    isLoading: false
  };
}