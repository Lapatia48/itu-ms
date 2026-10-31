import { useCallback, useEffect, useRef, useState } from 'react';

// Chargement d'une ressource distante avec etat loading/error/data et
// rechargement manuel. `deps` declenche un nouvel appel comme dans useEffect.
export function useResource(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Le loader est une fonction recreee a chaque rendu : on la garde dans une
  // ref pour que `reload` reste stable et ne relance pas la requete en boucle.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  // Un chargement plus ancien qui repond en retard ne doit pas ecraser le
  // resultat du plus recent.
  const tickRef = useRef(0);

  const reload = useCallback(async () => {
    const tick = ++tickRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (tick === tickRef.current) setData(result);
    } catch (err) {
      if (tick === tickRef.current) setError(err.message || 'Erreur inattendue');
    } finally {
      if (tick === tickRef.current) setLoading(false);
    }
  }, []);

  // Effet de chargement de donnees : le passage en `loading` fait partie de la
  // synchronisation avec le serveur, pas d'un calcul derivable du rendu.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);

  return { data, loading, error, reload, setData };
}

// Etat local d'un formulaire : valeurs, mise a jour champ par champ, reset.
export function useForm(initial) {
  const [values, setValues] = useState(initial);

  const setField = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const bind = useCallback(
    (name, { type = 'text' } = {}) => ({
      name,
      value: values[name] ?? '',
      onChange: (e) => {
        const target = e.target;
        setField(name, type === 'checkbox' ? target.checked : target.value);
      },
      ...(type === 'checkbox' ? { checked: Boolean(values[name]) } : null),
    }),
    [values, setField]
  );

  const reset = useCallback((next = initial) => setValues(next), [initial]);

  return { values, setValues, setField, bind, reset };
}

// Execution d'une action distante (submit) : busy + message d'erreur.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      return { ok: true, result };
    } catch (err) {
      setError(err.message || 'Erreur inattendue');
      return { ok: false, error: err };
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, setError, run };
}
