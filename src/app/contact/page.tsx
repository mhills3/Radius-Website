export const metadata = {
  title: "Contact",
  description: "Have feedback, found a bug, or want to partner with us? Get in touch.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      <div className="mx-auto max-w-xl px-6 pt-28 pb-24 md:pt-32">
        <div className="text-center">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a7a3a]">Contact</div>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-[3rem]">
            Get in touch.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-[#46554c]">
            Have feedback, found a bug, or want to partner with us? We&apos;d love to hear from you.
          </p>
        </div>

        <form action="https://formsubmit.co/info@radiusdiscgolf.com" method="POST" className="mt-10 space-y-4">
          <input type="hidden" name="_subject" value="New Contact Message — Radius" />
          <input type="hidden" name="_captcha" value="false" />
          <input type="hidden" name="_template" value="table" />
          <input type="hidden" name="_next" value="https://radiusdiscgolf.com/contact.html?submitted=1" />

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#16221b]">Name</label>
            <input name="name" placeholder="Your name" required className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#16221b] placeholder-[#8a968d] outline-none transition-colors focus:border-[var(--gold)]" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#16221b]">Email</label>
            <input type="email" name="email" placeholder="you@example.com" required className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#16221b] placeholder-[#8a968d] outline-none transition-colors focus:border-[var(--gold)]" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#16221b]">Message</label>
            <textarea name="message" rows={5} placeholder="What's on your mind?" required className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#16221b] placeholder-[#8a968d] outline-none transition-colors focus:border-[var(--gold)]" />
          </div>
          <button type="submit" className="w-full rounded-full bg-[var(--gold)] px-6 py-4 text-sm font-bold text-[#16221b] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]">
            Send message
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-[#6b7a70]">
          Prefer email? Reach us at{" "}
          <a href="mailto:info@radiusdiscgolf.com" className="font-bold text-[#9a7a3a] hover:underline">info@radiusdiscgolf.com</a>
        </p>
      </div>
    </div>
  );
}
