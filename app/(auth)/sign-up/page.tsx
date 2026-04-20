import { redirect } from "next/navigation";

// Sign-up shares the phone-OTP flow with sign-in. New users are auto-created
// on first verify and routed into /onboarding. We keep /sign-up as a friendly
// alias so marketing / external links resolve.
export default function SignUpPage() {
  redirect("/sign-in");
}
