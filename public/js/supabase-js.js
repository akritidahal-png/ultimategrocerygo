
<script>
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = "https://gikdqaxdqfmzdvolkxbn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpa2RxYXhkcWZtemR2b2xreGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyOTQwNDIsImV4cCI6MjA3Nzg3MDA0Mn0.pJ-9KfCxV7YT5loiURW14xRmf72s1EZRFRh4iKGnQis";

window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
</script>
