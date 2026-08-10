"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useTour } from "@/lib/tour-context";

export default function WalkthroughTour() {
    const { isOpen, stepIndex, steps, closeTour, nextStep, prevStep, goToStep } = useTour();

    if (!isOpen) return null;

    const step = steps[stepIndex];
    const StepIcon = step.icon;
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === steps.length - 1;

    return (
        <div className="tourOverlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeTour(); }}>
            <div className="tourCard">
                <button className="tourClose" onClick={closeTour} aria-label="Close walkthrough">
                    <X size={18} />
                </button>

                <div className="tourStepIcon">
                    <StepIcon size={26} />
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={stepIndex}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                        className="tourBody"
                    >
                        <span className="tourStepLabel">Step {stepIndex + 1} of {steps.length}</span>
                        <h3>{step.title}</h3>
                        <p>{step.description}</p>
                        {step.href && (
                            <Link href={step.href} className="tourLink" onClick={closeTour}>
                                {step.linkLabel || "Take me there"} <ArrowRight size={14} />
                            </Link>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="tourDots">
                    {steps.map((_, i) => (
                        <button
                            key={i}
                            className={`tourDot ${i === stepIndex ? "active" : ""}`}
                            onClick={() => goToStep(i)}
                            aria-label={`Go to step ${i + 1}`}
                        />
                    ))}
                </div>

                <div className="tourFoot">
                    <button className="tourSkip" onClick={closeTour}>Skip tour</button>
                    <div className="tourNav">
                        <button onClick={prevStep} disabled={isFirst} aria-label="Previous step">
                            <ArrowLeft size={16} /> Back
                        </button>
                        <button className="primary" onClick={nextStep}>
                            {isLast ? "Finish" : "Next"} {!isLast && <ArrowRight size={16} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
