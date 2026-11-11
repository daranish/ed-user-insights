import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { State } from "@/components/ui/state";

export function NotFound() {
  return (
    <State
      scene="404"
      title="Page not found"
      description="That link doesn't match a screen in this prototype."
      action={<Button asChild><Link to="/">Go home</Link></Button>}
      framed
    />
  );
}
