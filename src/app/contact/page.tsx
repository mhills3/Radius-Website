import ContactForm from "./ContactForm";

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

        <ContactForm />

        <p className="mt-8 text-center text-sm text-[#6b7a70]">
          Prefer email? Reach us at{" "}
          <a href="mailto:info@radiusdiscgolf.com" className="font-bold text-[#9a7a3a] hover:underline">info@radiusdiscgolf.com</a>
        </p>
      </div>
    </div>
  );
}
