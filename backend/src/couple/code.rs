//! Invite codes shared between partners: 8 characters, without look-alikes
//! (no 0/O, no 1/I), drawn from the operating system's secure RNG.

use rand::{Rng, rngs::OsRng};

/// 32 symbols: 24 letters + 8 digits. Must match the `couples.invite_code` check.
const ALPHABET: &[u8; 32] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
pub const LENGTH: usize = 8;

/// A fresh random invite code (32^8 ≈ 10^12 possibilities).
pub fn generate() -> String {
    let mut rng = OsRng;
    (0..LENGTH)
        .map(|_| char::from(ALPHABET[rng.gen_range(0..ALPHABET.len())]))
        .collect()
}

/// Normalizes a code typed by a person ("k7pq-2mxz" → "K7PQ2MXZ").
/// Returns `None` when it cannot be a valid code.
pub fn normalize(input: &str) -> Option<String> {
    let code: String = input
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| c.to_ascii_uppercase())
        .collect();

    let valid = code.len() == LENGTH && code.bytes().all(|b| ALPHABET.contains(&b));
    valid.then_some(code)
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    #[test]
    fn generated_codes_are_well_formed() {
        for _ in 0..1_000 {
            let code = generate();
            assert_eq!(normalize(&code).as_deref(), Some(code.as_str()));
        }
    }

    #[test]
    fn generated_codes_do_not_repeat() {
        let codes: HashSet<String> = (0..10_000).map(|_| generate()).collect();
        assert_eq!(codes.len(), 10_000);
    }

    #[test]
    fn typed_codes_are_forgiving() {
        assert_eq!(normalize(" k7pq-2mxz ").as_deref(), Some("K7PQ2MXZ"));
        assert_eq!(normalize("K7PQ 2MXZ").as_deref(), Some("K7PQ2MXZ"));
    }

    #[test]
    fn invalid_codes_are_rejected() {
        assert_eq!(normalize(""), None);
        assert_eq!(normalize("K7PQ2MX"), None, "too short");
        assert_eq!(normalize("K7PQ2MXZA"), None, "too long");
        assert_eq!(normalize("K7PQ2MX0"), None, "zero is not in the alphabet");
        assert_eq!(normalize("K7PQ2MXI"), None, "I is not in the alphabet");
        assert_eq!(normalize("K7PQ2MXé"), None);
    }
}
