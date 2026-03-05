import FundsManagerApp from "@/components/FundsManagerApp";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  return (
    <>
      <FundsManagerApp />
      <Analytics />
    </>
  );
}
