import { ArrowRight } from "lucide-react";
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
} from "@/app/chatgpt-auth";

export function AdultSignInLink() {
  return (
    <a href={chatGPTSignInPath("/")} target="_top" className="tf-primary">
      Adult sign-in <ArrowRight size={18} />
    </a>
  );
}

export function AdultSignOutLink() {
  return (
    <a className="tf-link" href={chatGPTSignOutPath("/")} target="_top">
      Sign out of adult account
    </a>
  );
}
