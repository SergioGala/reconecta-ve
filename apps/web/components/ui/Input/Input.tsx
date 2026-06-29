import styles from "./Input.module.css";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, ...props }: InputProps) {
  return (
    <label className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}
      <input className={styles.input} {...props} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}