import { Coffee } from "lucide-react";
import { useState } from "react";
import { Link } from "@/lib/router";

// The owner's personal bKash "My QR" image, dropped in as web/public/bkash-qr.png.
// Until it exists, the page says so instead of showing a broken image.
const QR_SRC = "/bkash-qr.png";

export function ChaPage() {
  const [hasQr, setHasQr] = useState(true);

  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-10 pb-20 md:px-10">
      <p className="eyebrow text-primary">Optional, always</p>
      <h1 className="mt-3.5 flex items-center gap-3 font-display text-6xl leading-[0.88] font-extrabold uppercase">
        Buy me a cha
        <Coffee aria-hidden="true" className="size-10 text-primary" />
      </h1>
      <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
        Khelbi Naki is free and has no ads. It costs nothing to run, so there's nothing to pay for — but if it found
        you a keeper, a cup of tea is always welcome.
      </p>

      <section aria-labelledby="bkash-heading" className="mt-8 rounded-3xl border border-[#242a1f] bg-card p-5 md:p-7">
        <h2 id="bkash-heading" className="font-display text-[34px] leading-none font-extrabold uppercase">
          bKash
        </h2>
        {hasQr ? (
          <>
            <ol className="mt-4 flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-muted-foreground">
              <li>Open the bKash app and tap Scan QR.</li>
              <li>Scan this code (on a phone: screenshot it, then pick it from your gallery).</li>
              <li>Send any amount with Send Money.</li>
            </ol>
            <img
              src={QR_SRC}
              onError={() => setHasQr(false)}
              alt="bKash QR code for sending money"
              width={260}
              height={260}
              className="mx-auto mt-6 rounded-2xl bg-white p-3"
            />
          </>
        ) : (
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            The bKash QR code isn't set up yet. Check back soon.
          </p>
        )}
      </section>

      <Link to="/" className="mt-8 inline-block font-semibold text-primary underline-offset-4 hover:underline">
        Back to open games
      </Link>
    </div>
  );
}
