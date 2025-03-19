interface MagicProps {
    className?: string;
}

export default function Magic({ className }: MagicProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M21.64 3.64a1.5 1.5 0 0 0-1.28-1.28c-.42-.12-.86-.1-1.25.09-.39.2-.68.55-.78.98L17.27 7H4.5A2.5 2.5 0 0 0 2 9.5c0 .83.41 1.56 1.04 2L12 18l3-6" />
            <path d="m14.5 17.5 2 2" />
            <path d="M5 8.5v-2" />
            <path d="M3.5 10H2" />
            <path d="M7 10h2" />
            <path d="M5 13.5v-2" />
        </svg>
    );
} 