export function GallerySvgIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        opacity="0.5"
        d="M2 12.5C2 8.55719 2 6.58579 3.29289 5.29289C4.58579 4 6.55719 4 10.5 4H13.5C17.4428 4 19.4142 4 20.7071 5.29289C22 6.58579 22 8.55719 22 12.5C22 16.4428 22 18.4142 20.7071 19.7071C19.4142 21 17.4428 21 13.5 21H10.5C6.55719 21 4.58579 21 3.29289 19.7071C2 18.4142 2 16.4428 2 12.5Z"
        fill="currentColor"
      />
      <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
      <path
        d="M5.25 16.75L8.46967 13.5303C9.11036 12.8896 10.1396 12.8896 10.7803 13.5303L13 15.75L13.9697 14.7803C14.6104 14.1396 15.6396 14.1396 16.2803 14.7803L18.75 17.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
