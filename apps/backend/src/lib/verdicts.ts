// Plain-language text for registration verdicts shown to the lecturer.

export const FAILED_REGISTRATION_TEXT: Record<string, string> = {
  NOT_ON_ROSTER: "isn't on this module's list.",
  NAME_MISMATCH: "typed a name that doesn't match your list.",
  DEVICE_BOUND_TO_OTHER_STUDENT: "used a phone that belongs to another student.",
  STUDENT_HAS_OTHER_DEVICE: "already has another phone. Reset the device if they changed phones.",
  BAD_SIGNATURE: "sent a request that failed the security check.",
};
