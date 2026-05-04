import { Injectable, signal, computed, type Signal } from "@angular/core";

export interface ValidationRule<T = unknown> {
  validate: (value: T) => boolean;
  message: string;
}

export interface FieldValidator<T = unknown> {
  errors: Signal<Record<string, string>>;
  touched: Signal<boolean>;
  dirty: Signal<boolean>;
  isValid: () => boolean;
  isInvalid: () => boolean;
  validate: (value: T) => void;
  touch: () => void;
  reset: () => void;
}

@Injectable({ providedIn: "root" })
export class FormValidationService {
  required<T = unknown>(message = "This field is required"): ValidationRule<T> {
    return {
      validate: (value: T) => value !== null && value !== undefined && String(value).trim() !== "",
      message,
    };
  }

  minLength<T = unknown>(min: number, message?: string): ValidationRule<T> {
    return {
      validate: (value: T) => value === null || value === undefined || String(value).length >= min,
      message: message || `Minimum ${min} characters required`,
    };
  }

  maxLength<T = unknown>(max: number, message?: string): ValidationRule<T> {
    return {
      validate: (value: T) => value === null || value === undefined || String(value).length <= max,
      message: message || `Maximum ${max} characters allowed`,
    };
  }

  pattern<T = unknown>(regex: RegExp, message = "Invalid format"): ValidationRule<T> {
    return {
      validate: (value: T) => value === null || value === undefined || regex.test(String(value)),
      message,
    };
  }

  email<T = unknown>(message = "Invalid email address"): ValidationRule<T> {
    return {
      validate: (value: T) => {
        if (value === null || value === undefined || value === "") return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
      },
      message,
    };
  }

  url<T = unknown>(message = "Invalid URL"): ValidationRule<T> {
    return {
      validate: (value: T) => {
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

  numberMin<T = unknown>(min: number, message?: string): ValidationRule<T> {
    return {
      validate: (value: T) => {
        if (value === null || value === undefined || value === "") return true;
        return Number(value) >= min;
      },
      message: message || `Minimum value is ${min}`,
    };
  }

  numberMax<T = unknown>(max: number, message?: string): ValidationRule<T> {
    return {
      validate: (value: T) => {
        if (value === null || value === undefined || value === "") return true;
        return Number(value) <= max;
      },
      message: message || `Maximum value is ${max}`,
    };
  }

  custom<T = string>(
    validatorFn: (value: T) => boolean,
    message = "Invalid value"
  ): ValidationRule<T> {
    return {
      validate: (value) => validatorFn(value as T),
      message,
    };
  }

  createFieldValidator<T = unknown>(rules: ValidationRule<T>[]): FieldValidator<T> {
    const errors = signal<Record<string, string>>({});
    const touched = signal(false);
    const dirty = signal(false);

    const validate = (value: T) => {
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

  createFormValidator<T extends Record<string, unknown>>(
    fieldValidators: Record<string, FieldValidator<T>>
  ) {
    return {
      validate: (values: T) => {
        let isValid = true;
        for (const [key, validator] of Object.entries(fieldValidators)) {
          validator.validate(values[key] as T);
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
