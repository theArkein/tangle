export type ValidationResult =
  | { valid: true }
  | {
      valid: false;
      reason:
        | "wrong_start"
        | "not_in_dictionary"
        | "duplicate"
        | "missing_required_letter"
        | "below_min_length";
    };

export interface Dictionary {
  has(word: string): Promise<boolean>;
}

export interface ValidateOptions {
  requiredContainingLetter?: string | undefined;
  minLength?: number | undefined;
  // When true, skip the "must start with requiredLetter" check (Wild power-up).
  skipLetterCheck?: boolean | undefined;
}

export async function validate(
  word: string,
  requiredLetter: string,
  usedWords: Set<string>,
  dictionary: Dictionary,
  options: ValidateOptions = {}
): Promise<ValidationResult> {
  const normalised = word.toLowerCase();
  const required = requiredLetter.toLowerCase();

  if (!options.skipLetterCheck && normalised[0] !== required) {
    return { valid: false, reason: "wrong_start" };
  }

  if (usedWords.has(normalised)) {
    return { valid: false, reason: "duplicate" };
  }

  if (options.minLength !== undefined && normalised.length < options.minLength) {
    return { valid: false, reason: "below_min_length" };
  }

  if (options.requiredContainingLetter) {
    const containing = options.requiredContainingLetter.toLowerCase();
    if (!normalised.includes(containing)) {
      return { valid: false, reason: "missing_required_letter" };
    }
  }

  if (!(await dictionary.has(normalised))) {
    return { valid: false, reason: "not_in_dictionary" };
  }

  return { valid: true };
}
