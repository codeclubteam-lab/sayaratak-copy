import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type PageTitle = { title: string; setTitle: (title: string) => void }

const PageTitleContext = createContext<PageTitle>({
  title: "",
  setTitle: () => {},
})

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("")
  const value = useMemo(() => ({ title, setTitle }), [title])
  return <PageTitleContext value={value}>{children}</PageTitleContext>
}

// What the topbar shows. Each dashboard page calls `usePageTitle` with its heading.
export const useTopbarTitle = () => useContext(PageTitleContext).title

export function usePageTitle(title: string) {
  const { setTitle } = useContext(PageTitleContext)
  useEffect(() => {
    setTitle(title)
    return () => setTitle("")
  }, [title, setTitle])
}
