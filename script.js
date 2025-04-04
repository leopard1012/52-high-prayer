// Google Apps Script 웹 앱 URL (★★★★★ 중요: 본인의 URL로 반드시 변경하세요! ★★★★★)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwezHpB-xzkYdhF4o8mrCna39iycloqkQY-XUSHLnqWxkRBwzHvYz3SWBcBb9JBYKzPIw/exec'; // <--- 위에서 복사한 Apps Script 웹 앱 URL을 여기에 붙여넣으세요.

// --- DOM 요소 가져오기 ---
const userInfoDiv = document.getElementById('userInfo');
const readCountSpan = document.getElementById('readCount');
const prayerTextDiv = document.getElementById('prayerText');
const completeButton = document.getElementById('completeButton');
const messageArea = document.getElementById('messageArea');
const changeUserButton = document.getElementById('changeUserButton');

// 모달 관련 요소
const userSelectionModal = document.getElementById('userSelectionModal');
const gradeSelect = document.getElementById('gradeSelect');
const groupSelect = document.getElementById('groupSelect');
const nameSelect = document.getElementById('nameSelect');
const confirmUserButton = document.getElementById('confirmUserButton');
const modalMessageArea = document.getElementById('modalMessageArea');

// --- 상태 변수 ---
let studentData = {}; // 전체 학생 명단 데이터 (학년 > 목장 > 이름 배열)
let currentUser = null; // 현재 선택된 사용자 정보 { grade, group, name }
let isProcessing = false; // 중복 클릭 방지 플래그
let lastScrollPosition = 0; // 스크롤 감지용
let scrollCheckEnabled = true; // 스크롤 감지 활성화 여부

// --- 함수 정의 ---

// 메시지 표시 함수 (성공/오류)
function showMessage(areaElement, message, isError = false) {
    areaElement.textContent = message;
    areaElement.className = 'message'; // 기본 클래스 초기화
    if (message) {
        areaElement.classList.add(isError ? 'error' : 'success');
    }
}

// 사용자 정보 화면 업데이트
function updateUserInfoDisplay() {
    if (currentUser) {
        userInfoDiv.innerHTML = `
            <p><strong>${currentUser.grade} / ${currentUser.group} / ${currentUser.name}</strong> 학생, 환영합니다!</p>
            <p>누적 완독: <span id="readCount">?</span>회 (불러오는 중...)</p>
        `;
        // 통계 다시 불러오기
        fetchUserStats();
    } else {
        userInfoDiv.innerHTML = `
            <p>사용자를 선택해주세요.</p>
            <p>누적 완독: <span id="readCount">0</span>회</p>
        `;
        document.getElementById('readCount').textContent = '0'; // 로그아웃 시 카운트 초기화
    }
}

// 사용자별 통계(완독 횟수) 불러오기
function fetchUserStats() {
    if (!currentUser) return;

    const params = new URLSearchParams({
        action: 'getUserStats',
        grade: currentUser.grade,
        group: currentUser.group,
        name: currentUser.name
    });

    fetch(`${SCRIPT_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                const stats = result.data;
                const countSpan = document.getElementById('readCount'); // 다시 가져와야 할 수 있음
                if (countSpan) {
                   countSpan.textContent = stats.count || 0;
                }
                 // 최근 완독 시간 표시 (선택사항)
                 // console.log("최근 완독:", stats.lastRead);
            } else {
                console.error('통계 불러오기 오류:', result.message);
                const countSpan = document.getElementById('readCount');
                if (countSpan) countSpan.textContent = '오류';
            }
        })
        .catch(error => {
            console.error('통계 fetch 오류:', error);
            const countSpan = document.getElementById('readCount');
            if (countSpan) countSpan.textContent = '오류';
        });
}


// 스크롤 감지 함수 (기도문 끝까지 스크롤했는지 확인)
function handleScroll() {
    // 스크롤 감지가 비활성화 되어 있거나, 버튼이 이미 활성화 되어있으면 종료
    if (!scrollCheckEnabled || !completeButton.disabled) return;

    const currentScroll = prayerTextDiv.scrollTop;
    // 스크롤을 아래로 내렸는지 확인 (위로 올리는 중에는 체크 안 함)
    //if (currentScroll > lastScrollPosition) {
        const scrollHeight = prayerTextDiv.scrollHeight; // 전체 내용 높이
        const clientHeight = prayerTextDiv.clientHeight; // 보이는 영역 높이
        const scrollBottom = scrollHeight - clientHeight; // 스크롤 가능한 최대 높이

        // 거의 끝까지 스크롤 했는지 확인 (약간의 오차 허용)
        if (currentScroll >= scrollBottom - 10) {
            completeButton.disabled = false; // 버튼 활성화
            completeButton.textContent = '완독 확인 및 기록';
            // 한 번 활성화 되면 스크롤 감지 일시 중단 (선택적)
            // scrollCheckEnabled = false;
        }
    //}
    //lastScrollPosition = currentScroll <= 0 ? 0 : currentScroll; // 현재 스크롤 위치 저장
}

// 완독 체크 처리 함수
function handleCompleteClick() {
    if (!currentUser || isProcessing || completeButton.disabled) {
        return; // 사용자 없거나, 처리 중이거나, 버튼 비활성이면 무시
    }

    isProcessing = true; // 처리 시작 플래그
    completeButton.disabled = true; // 버튼 즉시 비활성화
    completeButton.textContent = '기록 중...';
    showMessage(messageArea, ''); // 이전 메시지 삭제

    const dataToSend = {
        grade: currentUser.grade,
        group: currentUser.group,
        name: currentUser.name
    };

    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'cors', // CORS 허용 필요 (Apps Script 배포 시 '모든 사용자' 설정하면 보통 해결됨)
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json',
        },
        // Apps Script는 text/plain 으로 받을 수도 있음. 필요시 아래 주석 해제 및 JSON.stringify 제거
        // headers: { 'Content-Type': 'text/plain;charset=utf-8', },
        // body: JSON.stringify(dataToSend) // JSON 문자열로 전송
        redirect: 'follow',
        body: JSON.stringify(dataToSend) // POST 요청 본문에 데이터 담기
    })
    .then(response => response.json()) // 응답을 JSON으로 파싱
    .then(result => {
        if (result.status === 'success') {
            showMessage(messageArea, result.message || '완독 기록 완료!', false);
            // 현재 카운트를 1 증가시키거나, 통계를 다시 불러옴
            fetchUserStats(); // 서버에서 최신 카운트를 다시 가져옴
            // 성공 후 버튼 상태: 스크롤을 다시 해야 활성화되도록 그대로 둠
            completeButton.textContent = '완독 확인 (다시 스크롤)';
            // 스크롤 감지 다시 활성화
            scrollCheckEnabled = true;
        } else {
            // 실패 시 사용자에게 오류 메시지 표시
            showMessage(messageArea, result.message || '기록 중 오류가 발생했습니다.', true);
            completeButton.textContent = '오류 발생 (다시 시도)';
            // 오류 발생 시 버튼 다시 활성화하여 재시도 가능하게 함 (선택적)
             completeButton.disabled = false;
        }
    })
    .catch(error => {
        // 네트워크 오류 등 fetch 자체의 실패 처리
        console.error('Error sending data:', error);
        showMessage(messageArea, '데이터 전송 중 오류 발생. 인터넷 연결을 확인하세요.', true);
        completeButton.textContent = '전송 오류 (다시 시도)';
        completeButton.disabled = false; // 재시도 가능하게 버튼 활성화
    })
    .finally(() => {
        isProcessing = false; // 처리 완료 플래그 해제
        // 완독 버튼은 스크롤 감지에 의해 다시 활성화될 것이므로 여기서 활성화하지 않음.
        // 오류 시에는 위에서 활성화 해주었음.
    });
}

// --- 모달 관련 함수 ---

// 학생 명단 데이터 로드 및 학년 드롭다운 채우기
function loadStudentList() {
    fetch(`${SCRIPT_URL}?action=getStudentList`)
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success' && result.data) {
                studentData = result.data;
                populateGradeDropdown();
                // 저장된 사용자가 있으면 자동으로 선택 시도
                const savedUser = localStorage.getItem('prayerUser');
                 if (savedUser) {
                    currentUser = JSON.parse(savedUser);
                    // 드롭다운 자동 선택 시도 (선택적)
                    preselectDropdowns();
                    updateUserInfoDisplay(); // 환영 메시지 업데이트
                    closeModal(); // 모달 닫기
                } else {
                    openModal(); // 저장된 사용자 없으면 모달 열기
                }
            } else {
                console.error('학생 명단 로드 실패:', result.message);
                showMessage(modalMessageArea, '학생 명단을 불러오는데 실패했습니다.', true);
                 openModal(); // 데이터 로드 실패 시에도 모달은 열어둠
            }
        })
        .catch(error => {
            console.error('학생 명단 fetch 오류:', error);
            showMessage(modalMessageArea, '학생 명단 로드 중 오류 발생. 인터넷 연결 확인', true);
             openModal(); // 데이터 로드 실패 시에도 모달은 열어둠
        });
}


// 학년 드롭다운 채우기
function populateGradeDropdown() {
    gradeSelect.innerHTML = '<option value="">-- 학년 선택 --</option>'; // 초기화
    Object.keys(studentData).sort().forEach(grade => { // 학년 정렬
        const option = document.createElement('option');
        option.value = grade;
        option.textContent = grade;
        gradeSelect.appendChild(option);
    });
}

// 학년 선택 시 목장 드롭다운 채우기
function handleGradeChange() {
    const selectedGrade = gradeSelect.value;
    groupSelect.innerHTML = '<option value="">-- 목장 선택 --</option>'; // 초기화
    nameSelect.innerHTML = '<option value="">-- 이름 선택 --</option>'; // 초기화
    groupSelect.disabled = true;
    nameSelect.disabled = true;
    confirmUserButton.disabled = true;

    if (selectedGrade && studentData[selectedGrade]) {
        Object.keys(studentData[selectedGrade]).sort().forEach(group => { // 목장 정렬
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            groupSelect.appendChild(option);
        });
        groupSelect.disabled = false; // 목장 선택 활성화
    }
}

// 목장 선택 시 이름 드롭다운 채우기
function handleGroupChange() {
    const selectedGrade = gradeSelect.value;
    const selectedGroup = groupSelect.value;
    nameSelect.innerHTML = '<option value="">-- 이름 선택 --</option>'; // 초기화
    nameSelect.disabled = true;
    confirmUserButton.disabled = true;

    if (selectedGrade && selectedGroup && studentData[selectedGrade][selectedGroup]) {
        studentData[selectedGrade][selectedGroup].sort().forEach(name => { // 이름 정렬
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            nameSelect.appendChild(option);
        });
        nameSelect.disabled = false; // 이름 선택 활성화
    }
}

// 이름 선택 시 확인 버튼 활성화
function handleNameChange() {
    if (gradeSelect.value && groupSelect.value && nameSelect.value) {
        confirmUserButton.disabled = false; // 모든 선택 완료 시 버튼 활성화
    } else {
        confirmUserButton.disabled = true;
    }
}

// 사용자 선택 완료 처리
function confirmUserSelection() {
    const selectedGrade = gradeSelect.value;
    const selectedGroup = groupSelect.value;
    const selectedName = nameSelect.value;

    if (selectedGrade && selectedGroup && selectedName) {
        currentUser = { grade: selectedGrade, group: selectedGroup, name: selectedName };
        // 선택 정보 로컬 스토리지에 저장
        localStorage.setItem('prayerUser', JSON.stringify(currentUser));
        updateUserInfoDisplay(); // 메인 화면 업데이트
        closeModal(); // 모달 닫기
        showMessage(messageArea, ''); // 메인 메시지 영역 초기화
        // 완독 버튼 초기 상태로
        completeButton.disabled = true;
        completeButton.textContent = '아래로 스크롤하여 완독 후 클릭';
        scrollCheckEnabled = true; // 스크롤 감지 다시 시작
        prayerTextDiv.scrollTop = 0; // 스크롤 맨 위로
    } else {
         showMessage(modalMessageArea, '모든 항목(학년, 목장, 이름)을 선택해주세요.', true);
    }
}

// 로컬 스토리지 정보로 드롭다운 미리 선택 (페이지 로드 시)
function preselectDropdowns() {
    if (!currentUser || !studentData) return;

    if (currentUser.grade && studentData[currentUser.grade]) {
        gradeSelect.value = currentUser.grade;
        handleGradeChange(); // 목장 목록 로드
        if (currentUser.group && studentData[currentUser.grade][currentUser.group]) {
            groupSelect.value = currentUser.group;
            handleGroupChange(); // 이름 목록 로드
            if (currentUser.name && studentData[currentUser.grade][currentUser.group].includes(currentUser.name)) {
                nameSelect.value = currentUser.name;
                 handleNameChange(); // 확인 버튼 활성화
            }
        }
    }
     // 만약 저장된 정보가 현재 명단에 없다면 (전학 등), currentUser를 null로 하고 모달을 열어야 할 수도 있음
    // 이 부분은 필요에 따라 추가 구현
}

// --- script.js 파일 상단 또는 함수 모아두는 곳에 추가 ---

// 기도문 내용 로드 및 표시 함수
function loadPrayerText() {
    const prayerTextElement = document.getElementById('prayerText');
    // 기존 내용을 로딩 메시지로 설정 (HTML에도 있지만 JS에서도 설정 가능)
    prayerTextElement.innerHTML = '<p><em>기도문을 불러오는 중...</em></p>';

    fetch(`${SCRIPT_URL}?action=getPrayerText`) // action=getPrayerText 추가
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP 오류! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            if (result.status === 'success' && typeof result.data === 'string') {
                // 성공적으로 텍스트를 받아왔을 때
                // 받아온 텍스트의 줄바꿈(\n)을 HTML 줄바꿈(<br>)으로 변경 (선택 사항)
                // const formattedText = result.data.replace(/\n/g, '<br>');
                // prayerTextElement.innerHTML = formattedText;

                // 또는 innerText를 사용하여 텍스트와 줄바꿈 그대로 표시 (CSS로 white-space: pre-wrap; 필요할 수 있음)
                prayerTextElement.innerText = result.data;
                // CSS로 줄바꿈 처리: style.css 파일에 아래 내용 추가 권장
                // #prayerText { white-space: pre-wrap; word-wrap: break-word; }
            } else {
                // 데이터 형식이 잘못되었거나 status가 success가 아닐 때
                console.error('기도문 데이터 형식 오류:', result.message || '데이터 형식이 문자열이 아님');
                prayerTextElement.innerText = '기도문을 불러오는 데 실패했습니다. (형식 오류)';
            }
        })
        .catch(error => {
            // fetch 자체 오류 또는 response.ok 아닌 경우
            console.error('기도문 로드 fetch 오류:', error);
            prayerTextElement.innerText = '기도문을 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.';
        });
}


// --- script.js 파일 하단의 초기화 실행 부분 수정 ---

// 페이지 로드 시 실행될 초기화 함수들
function initializeApp() {
    loadStudentList(); // 기존 학생 명단 로드 함수 호출
    loadPrayerText();  // 새로 추가한 기도문 로드 함수 호출
}


// 모달 열기
function openModal() {
    // 현재 사용자 정보가 있다면 드롭다운 미리 선택
     if (currentUser) {
        preselectDropdowns();
     } else {
         // 사용자 정보 없으면 드롭다운 초기화
        gradeSelect.value = "";
        groupSelect.innerHTML = '<option value="">-- 목장 선택 --</option>';
        nameSelect.innerHTML = '<option value="">-- 이름 선택 --</option>';
        groupSelect.disabled = true;
        nameSelect.disabled = true;
        confirmUserButton.disabled = true;
     }
    modalMessageArea.textContent = ''; // 모달 메시지 초기화
    userSelectionModal.style.display = 'block'; // 모달 보이기
}

// 모달 닫기
function closeModal() {
    userSelectionModal.style.display = 'none'; // 모달 숨기기
}

// --- 이벤트 리스너 설정 ---
// 기도문 영역 스크롤 감지
prayerTextDiv.addEventListener('scroll', handleScroll);
// 완독 체크 버튼 클릭
completeButton.addEventListener('click', handleCompleteClick);
// 사용자 변경 버튼 클릭
changeUserButton.addEventListener('click', openModal);

// 모달 내 드롭다운 변경 감지
gradeSelect.addEventListener('change', handleGradeChange);
groupSelect.addEventListener('change', handleGroupChange);
nameSelect.addEventListener('change', handleNameChange);
// 모달 확인 버튼 클릭
confirmUserButton.addEventListener('click', confirmUserSelection);

// 모달 바깥 영역 클릭 시 닫기 (선택사항)
window.addEventListener('click', (event) => {
    if (event.target == userSelectionModal) {
        // closeModal(); // 사용자가 명확히 닫도록 두는 것이 나을 수 있음
    }
});


// --- 초기화 실행 ---
// 페이지 로드 시 학생 명단 로드 및 사용자 확인/선택 절차 시작
initializeApp();