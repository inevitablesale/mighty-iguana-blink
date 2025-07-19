import { Header } from "@/components/Header";
import { CommandBar } from "@/components/CommandBar";
import { useSearchParams } from "@/hooks/useSearchParams";
import { useState } from "react";

export default function Index() {
  const { isInitialView } = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  // ... rest of component ...
}