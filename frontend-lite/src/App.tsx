import { SpeedInsights } from "@vercel/speed-insights/react";
import FundsManagerApp from "@/components/FundsManagerApp";

export default function App() {
  return (
    <>
      <FundsManagerApp />
      <SpeedInsights />
    </>
  );
}
