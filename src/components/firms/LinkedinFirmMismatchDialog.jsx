import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

/**
 * Prompts the user to accept or reject a LinkedIn company page that the
 * lookup resolved when the LinkedIn company name does not appear to match
 * the entered firm name.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {{ firmName?: string, linkedinCompanyName?: string, linkedinUrl?: string, score?: number }|null} props.data
 * @param {(url: string) => void} props.onAccept
 * @param {() => void} props.onReject
 */
export default function LinkedinFirmMismatchDialog({ open, data, onAccept, onReject }) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onReject(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Verify LinkedIn company match
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                The LinkedIn page found doesn&rsquo;t appear to match the firm name you entered.
                Please confirm this is the correct company before applying it.
              </p>
              <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Your firm name</span>
                  <p className="font-medium text-foreground">{data?.firmName || "—"}</p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">LinkedIn company found</span>
                  <p className="font-medium text-foreground">{data?.linkedinCompanyName || "—"}</p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">LinkedIn URL</span>
                  <p className="font-mono text-xs text-foreground break-all">{data?.linkedinUrl || "—"}</p>
                </div>
              </div>
              <p className="text-muted-foreground">
                Accept to apply this LinkedIn URL anyway, or reject to discard it.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onReject}>Reject</AlertDialogCancel>
          <AlertDialogAction onClick={() => onAccept(data?.linkedinUrl)}>
            Accept &amp; apply
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}