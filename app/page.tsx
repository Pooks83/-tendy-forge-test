import { TrainingApp } from "@/components/goalie-forge/training-app";
import {
  AdultSignInLink,
  AdultSignOutLink,
} from "@/components/goalie-forge/auth-links";

export default function Home() {
  return (
    <TrainingApp
      signInLink={<AdultSignInLink />}
      signOutLink={<AdultSignOutLink />}
    />
  );
}
