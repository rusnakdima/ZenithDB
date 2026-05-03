import { Injectable, signal, computed, type Signal } from "@angular/core";

export interface ValidationRule {
  validate: (value: any) => boolean;
  message: string;
}

export interface FieldValidator {
  errors: Signal<Record<string, string>>;
  touched: Signal<boolean>;
  dirty: Signal<boolean>;
  isValid: () => boolean;
  isInvalid: () => boolean;
  validate: (value: any) => void;
  touch: () => void;
  reset: () => void;
}

@Injectable({ providedIn: "root" })
export class FormValidationService {
  required(message = "This field is required"): ValidationRule {
    return {
      validate: (value: any) =>
        value !== null && value !== undefined && String(value).trim() !== "",
      message,
    };
  }

  minLength(min: number, message?: string): ValidationRule {
    return {
      validate: (value: any) =>
        value === null || value === undefined || String(value).length >= min,
      message: message || `Minimum ${min} characters required`,
    };
  }

  maxLength(max: number, message?: string): ValidationRule {
    return {
      validate: (value: any) =>
        value === null || value === undefined || String(value).length <= max,
      message: message || `Maximum ${max} characters allowed`,
    };
  }

  pattern(regex: RegExp, message = "Invalid format"): ValidationRule {
    return {
      validate: (value: any) =>
        value === null || value === undefined || regex.test(String(value)),
      message,
    };
  }

  email(message = "Invalid email address"): ValidationRule {
    return {
      validate: (value: any) => {
        if (value === null || value === undefined || value === "") return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
      },
      message,
    };
  }

  url(message = "Invalid URL"): ValidationRule {
    return {
      validate: (value: any) => {
        if (value === null || value === undefined || value === "") return true;
        try {
          new URL(String(value));
          return true;
        } catch {
          return false;
        }
      },
      message,
    };
  }

  numberMin(min: number, message?: string): ValidationRule {
    return {
      validate: (value: any) => {
        if (value === null || value === undefined || value === "") return true;
        return Number(value) >= min;
      },
      message: message || `Minimum value is ${min}`,
    };
  }

  numberMax(max: number, message?: string): ValidationRule {
    return {
      validate: (value: any) => {
        if (value === null || value === undefined || value === "") return true;
        return Number(value) <= max;
      },
      message: message || `Maximum value is ${max}`,
    };
  }

  custom(
    validatorFn: (value: any) => boolean,
    message = "Invalid value"
  ): ValidationRule {
    return {
      validate: validatorFn,
      message,
    };
  }

  createFieldValidator(rules: ValidationRule[]): FieldValidator {
    const errors = signal<Record<string, string>>({});
    const touched = signal(false);
    const dirty = signal(false);

    const validate = (value: any) => {
      const newErrors: Record<string, string> = {};
      for (const rule of rules) {
        if (!rule.validate(value)) {
          newErrors[rule.message] = rule.message;
        }
      }
      errors.set(newErrors);
    };

    const touch = () => {
      touched.set(true);
    };

    const reset = () => {
      errors.set({});
      touched.set(false);
      dirty.set(false);
    };

    const isValid = computed(() => Object.keys(errors()).length === 0);
    const isInvalid = computed(() => !isValid());

    return {
      errors,
      touched,
      dirty,
      isValid,
      isInvalid,
      validate,
      touch,
      reset,
    };
  }

  createFormValidator(fieldValidators: Record<string, FieldValidator>) {
    return {
      validate: (values: Record<string, any>) => {
        let isValid = true;
        for (const [key, validator] of Object.entries(fieldValidators)) {
          validator.validate(values[key]);
          if (!validator.isValid()) {
            isValid = false;
          }
        }
        return isValid;
      },
      touchAll: () => {
        for (const validator of Object.values(fieldValidators)) {
          validator.touch();
        }
      },
      resetAll: () => {
        for (const validator of Object.values(fieldValidators)) {
          validator.reset();
        }
      },
      isValid: computed(() => {
        return Object.values(fieldValidators).every((v) => v.isValid());
      }),
      fieldValidators,
    };
  }
}