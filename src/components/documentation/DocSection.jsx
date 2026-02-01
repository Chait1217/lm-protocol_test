import React, { useEffect, useRef } from "react";

export default function DocSection({ id, children, onVisible }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible(id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, onVisible]);

  return (
    <section id={id} ref={ref} className="scroll-mt-24">
      {children}
    </section>
  );
}
