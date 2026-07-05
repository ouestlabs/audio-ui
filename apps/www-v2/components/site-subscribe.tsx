"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { RecaptchaPopover } from "./recaptcha-popover";

export function SiteSubscribe() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRecaptcha, setShowRecaptcha] = useState(false);

  const validateEmail = () => {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.custom(
        () => (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>
              Invalid email address. Please check and try again.
            </AlertTitle>
          </Alert>
        ),
        {
          position: "top-center",
        }
      );
      return false;
    }
    return true;
  };

  const isDev = process.env.NODE_ENV === "development";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateEmail()) {
      setShowRecaptcha(false);
      return;
    }

    // In development, skip reCAPTCHA and submit directly
    if (isDev) {
      await submitToApi("");
      return;
    }

    setShowRecaptcha(true);
  };

  const handleVerifiedSubmit = async (token: string) => {
    if (!token) {
      toast.custom(
        () => (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Please complete the reCAPTCHA verification.</AlertTitle>
          </Alert>
        ),
        {
          position: "top-center",
        }
      );
      return;
    }

    await submitToApi(token);
  };

  const submitToApi = async (token: string) => {
    setLoading(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["x-recaptcha-token"] = token;
      }

      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers,
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.custom(
          () => (
            <Alert>
              <CheckCircle2 className="size-4 text-green-500" />
              <AlertTitle>Thank you for your subscription!</AlertTitle>
            </Alert>
          ),
          {
            position: "top-center",
          }
        );
        setEmail("");
        setShowRecaptcha(false);
      } else {
        toast.custom(
          () => (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>
                {data.message ||
                  "Oops! Something unexpected happened. Please try again later."}
              </AlertTitle>
            </Alert>
          ),
          {
            position: "top-center",
          }
        );
      }
    } catch (err: unknown) {
      console.error("Newsletter subscription error:", err);
      toast.custom(
        () => (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>
              Oops! Something unexpected happened. Please try again later.
            </AlertTitle>
          </Alert>
        ),
        {
          position: "top-center",
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const style = {
    backgroundImage: `linear-gradient(0deg, transparent 0%, transparent 60%, rgba(183, 183, 183, 0.05) 60%, rgba(183, 183, 183, 0.05) 93%, transparent 93%, transparent 100%),
                      linear-gradient(135deg, transparent 0%, transparent 55%, rgba(183, 183, 183, 0.05) 55%, rgba(183, 183, 183, 0.05) 84%, transparent 84%, transparent 100%),
                      linear-gradient(0deg, transparent 0%, transparent 80%, rgba(183, 183, 183, 0.05) 80%, rgba(183, 183, 183, 0.05) 94%, transparent 94%, transparent 100%),
                      linear-gradient(90deg, rgb(0,0,0), rgb(0,0,0))`,
  };

  return (
    <footer className="pb-6 [contain-intrinsic-size:1px_420px] [content-visibility:auto]">
      <div className="container">
        <div
          className="site-rounded-xl flex flex-wrap items-center justify-between gap-7 px-10 py-10 md:px-20 md:py-16"
          style={style}
        >
          <div className="flex flex-col gap-1.5">
            <h2 className="font-medium text-3xl text-white">
              Stay notified on every new release
            </h2>
            <div className="font-medium text-2xl text-white/50">
              Only the updates worth knowing
            </div>
          </div>

          <form
            className="flex w-full flex-col items-stretch gap-2.5 md:w-auto md:flex-row md:items-center"
            onSubmit={handleSubmit}
          >
            <Input
              className="site-rounded-lg h-auto w-full border border-site-input/20 bg-white/5 px-5 py-3 text-white/80 placeholder:text-white/50 focus:outline-none focus:ring md:w-64"
              onChange={(e) => {
                setEmail(e.target.value);
                setShowRecaptcha(false);
              }}
              placeholder="Your email address"
              required
              type="email"
              value={email}
            />

            <RecaptchaPopover
              isLoading={loading}
              onOpenChange={(open: boolean) => {
                if (!open) {
                  setShowRecaptcha(false);
                }
              }}
              onVerify={handleVerifiedSubmit}
              open={showRecaptcha}
              trigger={
                <Button
                  className="site-rounded-lg h-auto w-full bg-white px-5 py-3 font-semibold text-black/80 hover:bg-white hover:text-black md:w-auto"
                  disabled={loading}
                  type="submit"
                >
                  {loading ? "Subscribing..." : "Subscribe"}
                </Button>
              }
              verifyButtonText="Verify & Subscribe"
            />
          </form>
        </div>
      </div>
    </footer>
  );
}
